// Filing a queued document against a person, and dismissing one that isn't a
// record. These are the only two ways an entry leaves the queue.
//
// The caller passes the subject explicitly and the matcher is never re-run
// here. Whatever the queue proposed, what gets filed is what a named human
// chose — the suggestion is an input to their decision, not a fallback for it.

import { randomUUID } from "node:crypto";

import { INBOUND } from "./queue.mjs";
import { labelFor } from "./classify.mjs";
import { HttpError } from "./auth.mjs";
import { BUCKETS } from "./supabase.mjs";
import { fromRow, toRow, patchRow } from "./records.mjs";

/**
 * @param {{sb: import("@supabase/supabase-js").SupabaseClient}} ctx
 * @param {{inboundId: string, subjectType: "client"|"staff", subjectId: string}} input
 * @param {{uid: string, name: string}} actor
 */
export async function fileInboundDocument(ctx, input, actor) {
  const { sb } = ctx;
  const { inboundId, subjectType, subjectId } = input || {};

  if (!inboundId || !["client", "staff"].includes(subjectType) || !subjectId) {
    throw new HttpError(400, "inboundId, subjectType and subjectId are required.");
  }

  const { data: inboundRow } = await sb.from(INBOUND).select("*").eq("id", inboundId).maybeSingle();
  const inbound = fromRow(INBOUND, inboundRow);
  if (!inbound) throw new HttpError(404, "That queue entry no longer exists.");
  if (inbound.status !== "pending") throw new HttpError(409, `Already ${inbound.status}.`);
  if (!inbound.sourcePath) {
    throw new HttpError(409, "That entry has no source document to file.");
  }

  // Confirm the person exists before writing anything to their file.
  const { data: subject } = await sb
    .from(subjectType === "client" ? "clients" : "users")
    .select("name")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject) throw new HttpError(404, "No such person on the roster.");
  const subjectName = subject.name || "Unknown";

  // The id is generated here rather than by the database so the stored object
  // can carry it in its name, matching the convention the in-app filing
  // pipeline already uses.
  const submissionId = randomUUID();
  // Bucket-relative: the bucket IS `filed`, so the old "filed/" prefix is gone.
  const filedPath = `${subjectType}/${subjectId}/${submissionId}__${Date.now()}.pdf`;

  // Copy rather than move. The queue entry keeps pointing at the document
  // exactly as it arrived, so a mis-filing can be traced back to what the
  // reviewer was actually looking at when they decided.
  //
  // Across buckets, so it is a download-and-upload rather than a server-side
  // copy: `inbound` and `filed` are separate buckets here, where Firebase had
  // one bucket with two prefixes.
  const { data: sourceBlob, error: downloadError } = await sb.storage
    .from(BUCKETS.inbound)
    .download(inbound.sourcePath);
  if (downloadError) {
    throw new HttpError(409, "The source document could not be read from storage.");
  }

  const { error: uploadError } = await sb.storage
    .from(BUCKETS.filed)
    .upload(filedPath, sourceBlob, {
      contentType: inbound.contentType || "application/pdf",
      upsert: false,
    });
  if (uploadError) {
    throw new HttpError(500, "The document could not be filed into storage.");
  }

  const now = new Date().toISOString();
  const isClient = subjectType === "client";

  // No permanent URL is stored. The old code minted a Firebase download token
  // that never expired and lived in the record forever; the app now signs a
  // short-lived URL from pdfPath at read time, so access is re-decided against
  // the storage policies on every view.
  const { error: insertError } = await sb.from("submissions").insert({
    id: submissionId,
    ...toRow("submissions", {
    // Not a form filled in the app — an external document filed into the same
    // cabinet, so it appears on the person's file alongside everything else.
    origin: "inbound",
    inboundId,
    schemaKey: `external:${inbound.docType}`,
    templateName: labelFor(inbound.docType),
    status: "submitted",

    clientId: isClient ? subjectId : null,
    clientName: isClient ? subjectName : null,
    // A staff-subject document files under that person; a client-subject
    // document must NOT also carry a caregiverId, or it would surface in a
    // caregiver's own file as well as the client's.
    caregiverId: isClient ? null : subjectId,
    caregiverName: isClient ? null : subjectName,

    subjectType,
    subjectId,

    submittedAt: inbound.receivedAt || now,
    filedAt: now,
    filedBy: actor.uid,
    filedByName: actor.name,

    pdfPath: filedPath,
    pdfFiledAt: now,
    pdfPending: false,

    sourceSummary: {
      source: inbound.source,
      from: inbound.from || null,
      subject: inbound.subject || null,
      fileName: inbound.fileName || null,
    },
    correctionHistory: [],
    }),
  });
  if (insertError) throw new HttpError(500, "The filing record could not be created.");

  const proposed = inbound.candidates?.[0];
  await patchRow(sb, INBOUND, inboundId, {
    status: "filed",
    subjectType,
    subjectId,
    subjectName,
    submissionId,
    filedPath,
    resolvedBy: actor.uid,
    resolvedByName: actor.name,
    resolvedAt: now,
    // Whether the reviewer took the suggestion or overrode it. This is the only
    // honest measure of whether the matcher is any good, and it costs nothing
    // to record now and everything to reconstruct later.
    resolutionKind: proposed && proposed.id === subjectId ? "confirmed" : "corrected",
    proposedId: proposed?.id || null,
    proposedConfidence: inbound.confidence || null,
  });

  await sb.from("audit").insert({
    id: randomUUID(),
    ...toRow("audit", {
      action: "inbound_filed",
      target: labelFor(inbound.docType),
      detail: `Filed to ${subjectName}`,
      actor: actor.name,
      role: actor.role || "officeManager",
      timestamp: now,
      inboundId,
      submissionId,
    }),
  });

  return { submissionId, filedPath, subjectName };
}

/**
 * Mark a queue entry as not a compliance document.
 *
 * Dismissed, never deleted — the source object stays in storage and the entry
 * stays in the queue with a reason on it. "We looked at this and decided it was
 * nothing" is itself a record worth keeping.
 */
export async function dismissInboundDocument(ctx, input, actor) {
  const { sb } = ctx;
  const { inboundId, reason } = input || {};
  if (!inboundId) throw new HttpError(400, "inboundId is required.");

  const { data: row } = await sb.from(INBOUND).select("*").eq("id", inboundId).maybeSingle();
  const entry = fromRow(INBOUND, row);
  if (!entry) throw new HttpError(404, "That queue entry no longer exists.");
  if (entry.status !== "pending") throw new HttpError(409, `Already ${entry.status}.`);

  const now = new Date().toISOString();
  await patchRow(sb, INBOUND, inboundId, {
    status: "dismissed",
    dismissReason: reason || null,
    resolvedBy: actor.uid,
    resolvedByName: actor.name,
    resolvedAt: now,
    resolutionKind: "dismissed",
  });

  await sb.from("audit").insert({
    id: randomUUID(),
    ...toRow("audit", {
      action: "inbound_dismissed",
      target: entry.fileName || "Document",
      detail: reason || "",
      actor: actor.name,
      role: actor.role || "officeManager",
      timestamp: now,
      inboundId,
    }),
  });

  return { ok: true };
}

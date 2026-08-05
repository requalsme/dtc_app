// Filing a queued document against a person, and dismissing one that isn't a
// record. These are the only two ways an entry leaves the queue.
//
// The caller passes the subject explicitly and the matcher is never re-run
// here. Whatever the queue proposed, what gets filed is what a named human
// chose — the suggestion is an input to their decision, not a fallback for it.

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

import { INBOUND } from "./queue.mjs";
import { labelFor } from "./classify.mjs";
import { HttpError } from "./auth.mjs";

/**
 * @param {{db: FirebaseFirestore.Firestore, bucket: any}} ctx
 * @param {{inboundId: string, subjectType: "client"|"staff", subjectId: string}} input
 * @param {{uid: string, name: string}} actor
 */
export async function fileInboundDocument(ctx, input, actor) {
  const { db, bucket } = ctx;
  const { inboundId, subjectType, subjectId } = input || {};

  if (!inboundId || !["client", "staff"].includes(subjectType) || !subjectId) {
    throw new HttpError(400, "inboundId, subjectType and subjectId are required.");
  }

  const inboundRef = db.collection(INBOUND).doc(inboundId);
  const inbound = (await inboundRef.get()).data();
  if (!inbound) throw new HttpError(404, "That queue entry no longer exists.");
  if (inbound.status !== "pending") throw new HttpError(409, `Already ${inbound.status}.`);
  if (!inbound.sourcePath) {
    throw new HttpError(409, "That entry has no source document to file.");
  }

  // Confirm the person exists before writing anything to their file.
  const subjectSnap = await db
    .collection(subjectType === "client" ? "clients" : "users")
    .doc(subjectId)
    .get();
  if (!subjectSnap.exists) throw new HttpError(404, "No such person on the roster.");
  const subjectName = subjectSnap.data().name || "Unknown";

  // Create the record first so the stored object can carry its id, matching the
  // convention the in-app filing pipeline already uses.
  const submissionRef = db.collection("submissions").doc();
  const filedPath = `filed/${subjectType}/${subjectId}/${submissionRef.id}__${Date.now()}.pdf`;

  // Copy rather than move. The queue entry keeps pointing at the document
  // exactly as it arrived, so a mis-filing can be traced back to what the
  // reviewer was actually looking at when they decided.
  const downloadToken = randomUUID();
  await bucket.file(inbound.sourcePath).copy(bucket.file(filedPath), {
    metadata: {
      contentType: inbound.contentType || "application/pdf",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        filedBy: actor.uid,
        inboundId,
      },
    },
  });
  const pdfUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodeURIComponent(filedPath)}?alt=media&token=${downloadToken}`;

  const now = new Date().toISOString();
  const isClient = subjectType === "client";

  await submissionRef.set({
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

    pdfUrl,
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
  });

  const proposed = inbound.candidates?.[0];
  await inboundRef.update({
    status: "filed",
    subjectType,
    subjectId,
    subjectName,
    submissionId: submissionRef.id,
    filedPath,
    filedUrl: pdfUrl,
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

  await db.collection("audit").add({
    action: "inbound_filed",
    target: labelFor(inbound.docType),
    detail: `Filed to ${subjectName}`,
    actor: actor.name,
    role: actor.role || "officeManager",
    timestamp: now,
    at: FieldValue.serverTimestamp(),
    inboundId,
    submissionId: submissionRef.id,
  });

  return { submissionId: submissionRef.id, pdfUrl, subjectName };
}

/**
 * Mark a queue entry as not a compliance document.
 *
 * Dismissed, never deleted — the source object stays in storage and the entry
 * stays in the queue with a reason on it. "We looked at this and decided it was
 * nothing" is itself a record worth keeping.
 */
export async function dismissInboundDocument(ctx, input, actor) {
  const { db } = ctx;
  const { inboundId, reason } = input || {};
  if (!inboundId) throw new HttpError(400, "inboundId is required.");

  const ref = db.collection(INBOUND).doc(inboundId);
  const entry = (await ref.get()).data();
  if (!entry) throw new HttpError(404, "That queue entry no longer exists.");
  if (entry.status !== "pending") throw new HttpError(409, `Already ${entry.status}.`);

  const now = new Date().toISOString();
  await ref.update({
    status: "dismissed",
    dismissReason: reason || null,
    resolvedBy: actor.uid,
    resolvedByName: actor.name,
    resolvedAt: now,
    resolutionKind: "dismissed",
  });

  await db.collection("audit").add({
    action: "inbound_dismissed",
    target: entry.fileName || "Document",
    detail: reason || "",
    actor: actor.name,
    role: actor.role || "officeManager",
    timestamp: now,
    at: FieldValue.serverTimestamp(),
    inboundId,
  });

  return { ok: true };
}

// Ingestion for Dare to Care.
//
// Three entry points:
//
//   pollOutlook              scheduled — pulls new attachments into the queue
//   resolveInboundDocument   callable  — a human confirms who it belongs to,
//                                        and only then is it filed
//   dismissInboundDocument   callable  — not a compliance document
//
// The split is the whole point. The scheduled half can be wrong as often as it
// likes; it only ever produces suggestions. Nothing reaches a person's file
// without someone clicking a name.

import { randomUUID } from "node:crypto";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";

import { loadRoster } from "./src/roster.mjs";
import { enqueue, INBOUND } from "./src/queue.mjs";
import { getToken, listMessagesSince, listAttachments } from "./src/graph.mjs";
import { labelFor } from "./src/classify.mjs";

initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();

// Graph credentials. Secrets live in Secret Manager, never in the repo.
const GRAPH_TENANT_ID = defineSecret("GRAPH_TENANT_ID");
const GRAPH_CLIENT_ID = defineSecret("GRAPH_CLIENT_ID");
const GRAPH_CLIENT_SECRET = defineSecret("GRAPH_CLIENT_SECRET");
const DTC_MAILBOX = defineString("DTC_MAILBOX", {
  description: "The Outlook mailbox to watch, e.g. intake@daretocarehomecare.com",
  default: "",
});

// Attachment types worth queueing. Everything else on a message is ignored —
// case managers attach logos, vcards and read receipts, and each one that
// reaches the queue costs a reviewer a decision for nothing.
const KEEP = /\.(pdf|jpe?g|png|tiff?|docx?)$/i;
const MAX_BYTES = 25 * 1024 * 1024;

// ─── Scheduled poll ────────────────────────────────────────────────────────

export const pollOutlook = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "America/Denver",
    secrets: [GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET],
    timeoutSeconds: 540,
    memory: "512MiB",
    retryCount: 1,
  },
  async () => {
    const mailbox = DTC_MAILBOX.value();
    if (!mailbox) {
      // Deployed but not configured. Say so loudly rather than looking healthy
      // while silently ingesting nothing — a quiet queue is indistinguishable
      // from a working one until a survey.
      logger.error("DTC_MAILBOX is not set; the Outlook poll is doing nothing.");
      return;
    }

    const stateRef = db.collection("metadata").doc("ingestion");
    const state = (await stateRef.get()).data() || {};
    // First run looks back 30 days rather than all time: enough to prove the
    // pipeline works without flooding the queue with a year of history. The
    // certification backfill is a separate, deliberate import.
    const since = state.outlookWatermark || new Date(Date.now() - 30 * 864e5).toISOString();

    const token = await getToken({
      tenantId: GRAPH_TENANT_ID.value(),
      clientId: GRAPH_CLIENT_ID.value(),
      clientSecret: GRAPH_CLIENT_SECRET.value(),
    });

    const roster = await loadRoster(db);
    const messages = await listMessagesSince(token, mailbox, since);

    let queued = 0;
    let watermark = since;

    for (const msg of messages) {
      try {
        if (msg.hasAttachments) {
          const attachments = await listAttachments(token, mailbox, msg.id);
          for (const att of attachments) {
            if (!KEEP.test(att.name || "")) continue;
            if (att.size > MAX_BYTES) {
              logger.warn(`Skipping oversized attachment ${att.name} (${att.size} bytes)`);
              continue;
            }
            await enqueue(
              { db, bucket, roster },
              {
                source: "email",
                // Stable across re-polls: the same attachment on the same
                // message always produces the same key, so a watermark that
                // slips backwards cannot duplicate the queue.
                dedupeKey: `email:${msg.internetMessageId || msg.id}:${att.id}`,
                fileName: att.name,
                content: att.content,
                contentType: att.contentType,
                subject: msg.subject,
                from: msg.from?.emailAddress?.address || null,
                body: msg.bodyPreview,
                receivedAt: msg.receivedDateTime,
              },
            );
            queued++;
          }
        }
        // The watermark only advances past a message that fully succeeded.
        watermark = msg.receivedDateTime;
      } catch (err) {
        // Stop at the first failure rather than skipping past it. Advancing the
        // watermark over a message we could not read would lose it silently,
        // and a referral that never arrives is worse than a poll that retries.
        logger.error(`Failed on message ${msg.id}; stopping this run.`, err);
        break;
      }
    }

    await stateRef.set(
      { outlookWatermark: watermark, lastPollAt: new Date().toISOString(), lastQueued: queued },
      { merge: true },
    );
    logger.info(`Outlook poll complete: ${queued} document(s) queued, watermark ${watermark}`);
  },
);

// ─── Resolution ────────────────────────────────────────────────────────────

async function requireReviewer(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const user = (await db.collection("users").doc(uid).get()).data();
  const role = user?.role;
  if (role !== "admin" && role !== "officeManager") {
    throw new HttpsError(
      "permission-denied",
      "Only an office manager or administrator can file an inbound document.",
    );
  }
  return { uid, name: user?.name || "Office", role };
}

/**
 * File a queued document against a person.
 *
 * The caller passes the subject explicitly — the server never re-runs the
 * matcher and never trusts its own earlier suggestion. Whatever the queue
 * proposed, what gets filed is what a named human chose.
 */
export const resolveInboundDocument = onCall(async (request) => {
  const actor = await requireReviewer(request);
  const { inboundId, subjectType, subjectId } = request.data || {};

  if (!inboundId || !["client", "staff"].includes(subjectType) || !subjectId) {
    throw new HttpsError("invalid-argument", "inboundId, subjectType and subjectId are required.");
  }

  const inboundRef = db.collection(INBOUND).doc(inboundId);
  const inbound = (await inboundRef.get()).data();
  if (!inbound) throw new HttpsError("not-found", "That queue entry no longer exists.");
  if (inbound.status !== "pending") {
    throw new HttpsError("failed-precondition", `Already ${inbound.status}.`);
  }
  if (!inbound.sourcePath) {
    throw new HttpsError("failed-precondition", "That entry has no source document to file.");
  }

  // Confirm the person exists before writing anything to their file.
  const subjectSnap = await db
    .collection(subjectType === "client" ? "clients" : "users")
    .doc(subjectId)
    .get();
  if (!subjectSnap.exists) throw new HttpsError("not-found", "No such person on the roster.");
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
    type: "inbound_filed",
    at: FieldValue.serverTimestamp(),
    actorId: actor.uid,
    actorName: actor.name,
    detail: `${labelFor(inbound.docType)} filed to ${subjectName}`,
    inboundId,
    submissionId: submissionRef.id,
  });

  return { submissionId: submissionRef.id, pdfUrl, subjectName };
});

/**
 * Mark a queue entry as not a compliance document.
 *
 * Dismissed, never deleted — the source object stays in storage and the entry
 * stays in the queue with a reason on it. "We looked at this and decided it was
 * nothing" is itself a record worth keeping.
 */
export const dismissInboundDocument = onCall(async (request) => {
  const actor = await requireReviewer(request);
  const { inboundId, reason } = request.data || {};
  if (!inboundId) throw new HttpsError("invalid-argument", "inboundId is required.");

  const ref = db.collection(INBOUND).doc(inboundId);
  const entry = (await ref.get()).data();
  if (!entry) throw new HttpsError("not-found", "That queue entry no longer exists.");
  if (entry.status !== "pending") {
    throw new HttpsError("failed-precondition", `Already ${entry.status}.`);
  }

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
    type: "inbound_dismissed",
    at: FieldValue.serverTimestamp(),
    actorId: actor.uid,
    actorName: actor.name,
    detail: `${entry.fileName || "Document"} dismissed${reason ? `: ${reason}` : ""}`,
    inboundId,
  });

  return { ok: true };
});

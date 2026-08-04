// The ingestion queue.
//
// One document in, one queue entry out. Nothing here files anything, marks
// anyone compliant, or writes to `submissions`. It stores the original document
// exactly as it arrived, records who it might belong to and why, and stops.
//
// Storing the source matters as much as the matching: a surveyor asking for
// evidence wants the CBI result PDF, not a row that says "passed".

import { classify } from "./classify.mjs";
import { matchName } from "./matcher.mjs";

/** Firestore collection holding documents awaiting review. */
export const INBOUND = "inbound";

/** Storage prefix for source documents that have not been filed yet. */
export const INBOUND_PREFIX = "inbound";

/**
 * Add one inbound document to the review queue.
 *
 * Idempotent on `dedupeKey`: re-running a poll or re-importing a batch updates
 * the existing entry rather than queueing the same document twice. A reviewer
 * who has already resolved an entry is never shown it again.
 *
 * @param {object} ctx
 * @param {FirebaseFirestore.Firestore} ctx.db
 * @param {import("firebase-admin/storage").Bucket} ctx.bucket
 * @param {Array} ctx.roster
 * @param {object} item
 * @param {"email"|"goformz"|"certifications"|"manual"} item.source
 * @param {string} item.dedupeKey       stable id for this document at its source
 * @param {string} item.fileName
 * @param {Buffer} [item.content]       the source document itself
 * @param {string} [item.contentType]
 * @param {string} [item.subject]
 * @param {string} [item.from]
 * @param {string} [item.body]
 * @param {string} [item.receivedAt]    ISO
 * @param {string} [item.nameHint]      text to match on, if not the subject
 */
export async function enqueue(ctx, item) {
  const { db, bucket, roster } = ctx;

  const existing = await db
    .collection(INBOUND)
    .where("dedupeKey", "==", item.dedupeKey)
    .limit(1)
    .get();

  // Already dealt with by a person — leave it alone. Re-queueing a resolved
  // document would ask someone to make the same decision twice, and the second
  // answer might not match the first.
  if (!existing.empty && existing.docs[0].data().status !== "pending") {
    return { id: existing.docs[0].id, skipped: "already resolved" };
  }

  const { docType, expect, label, matchedOn } = classify({
    subject: item.subject,
    fileName: item.fileName,
    from: item.from,
    body: item.body,
  });

  // Match on the filename and subject together. Case managers put the client's
  // name in one or the other, rarely both, and never consistently.
  const nameText = item.nameHint ?? [item.fileName, item.subject].filter(Boolean).join(" ");
  const match = matchName(nameText, roster, { expect });

  const ref = existing.empty ? db.collection(INBOUND).doc() : existing.docs[0].ref;

  // Store the source document under the queue entry's own id, so the object and
  // the record can never drift apart.
  let sourcePath = null;
  if (item.content) {
    sourcePath = `${INBOUND_PREFIX}/${ref.id}/${sanitize(item.fileName)}`;
    await bucket.file(sourcePath).save(item.content, {
      contentType: item.contentType || "application/octet-stream",
      resumable: false,
      metadata: {
        metadata: {
          source: item.source,
          dedupeKey: item.dedupeKey,
        },
      },
    });
  }

  const record = {
    source: item.source,
    dedupeKey: item.dedupeKey,
    fileName: item.fileName,
    contentType: item.contentType || null,
    subject: item.subject || null,
    from: item.from || null,
    receivedAt: item.receivedAt || new Date().toISOString(),

    docType,
    docLabel: label,
    classifiedOn: matchedOn,

    nameText,
    confidence: match.confidence,
    matchNote: match.note,
    candidates: match.candidates,

    sourcePath,
    status: "pending",
    queuedAt: new Date().toISOString(),
  };

  await ref.set(record, { merge: true });
  return { id: ref.id, confidence: match.confidence, docType };
}

// Storage object names are not a place to trust an external filename.
function sanitize(name) {
  return (
    String(name || "document")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 120) || "document"
  );
}

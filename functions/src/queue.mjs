// The ingestion queue.
//
// One document in, one queue entry out. Nothing here files anything, marks
// anyone compliant, or writes to `submissions`. It stores the original document
// exactly as it arrived, records who it might belong to and why, and stops.
//
// Storing the source matters as much as the matching: a surveyor asking for
// evidence wants the CBI result PDF, not a row that says "passed".

import { randomUUID } from "node:crypto";

import { classify } from "./classify.mjs";
import { matchName } from "./matcher.mjs";
import { BUCKETS } from "./supabase.mjs";
import { toRow } from "./records.mjs";

/** Table holding documents awaiting review. */
export const INBOUND = "inbound";

/**
 * Add one inbound document to the review queue.
 *
 * Idempotent on `dedupeKey`: re-running a poll or re-importing a batch updates
 * the existing entry rather than queueing the same document twice. A reviewer
 * who has already resolved an entry is never shown it again.
 *
 * @param {object} ctx
 * @param {import("@supabase/supabase-js").SupabaseClient} ctx.sb
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
  const { sb, roster } = ctx;

  // dedupeKey lives inside the jsonb document rather than as a promoted column,
  // so this filters on the JSON field directly. It is an equality match on one
  // key, which is what the Firestore `where` did.
  const { data: matches } = await sb
    .from(INBOUND)
    .select("*")
    .eq("data->>dedupeKey", item.dedupeKey)
    .limit(1);

  const existing = matches?.[0] || null;

  // Already dealt with by a person — leave it alone. Re-queueing a resolved
  // document would ask someone to make the same decision twice, and the second
  // answer might not match the first.
  if (existing && existing.status !== "pending") {
    return { id: existing.id, skipped: "already resolved" };
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

  const entryId = existing?.id || randomUUID();

  // Store the source document under the queue entry's own id, so the object and
  // the record can never drift apart.
  //
  // Bucket-relative: `inbound` is its own bucket now, where Firebase used one
  // bucket with an "inbound/" prefix.
  //
  // No download token and no stored URL. Firebase needed one because objects
  // written by the admin SDK were otherwise unreachable from the browser SDK;
  // here the `inbound read` storage policy grants staff access directly, and
  // the reviewer's own session signs a short-lived URL when they open it.
  let sourcePath = null;
  if (item.content) {
    sourcePath = `${entryId}/${sanitize(item.fileName)}`;
    const { error } = await sb.storage
      .from(BUCKETS.inbound)
      .upload(sourcePath, item.content, {
        contentType: item.contentType || "application/octet-stream",
        upsert: true,
      });
    if (error) throw new Error(`Could not store the source document: ${error.message}`);
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

  // Upsert on the entry id: re-running a poll updates the pending entry in
  // place rather than queueing the same document twice.
  const { error } = await sb.from(INBOUND).upsert({ id: entryId, ...toRow(INBOUND, record) });
  if (error) throw new Error(`Could not queue the document: ${error.message}`);

  return { id: entryId, confidence: match.confidence, docType };
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

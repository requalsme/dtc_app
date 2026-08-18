// One pass over the mailbox.
//
// Written to a wall-clock budget rather than "process everything". Free-tier
// function runtimes are short, and a poll that gets killed mid-attachment is
// worse than one that stops politely and picks up where it left off. The
// watermark makes that safe: it only ever advances past a message that was
// fully handled, so an interrupted run costs a few minutes, not a referral.

import { loadRoster } from "./roster.mjs";
import { enqueue } from "./queue.mjs";
import * as realGraph from "./graph.mjs";

// Attachment types worth queueing. Everything else on a message is ignored —
// case managers attach logos, vcards and read receipts, and each one that
// reaches the queue costs a reviewer a decision for nothing.
const KEEP = /\.(pdf|jpe?g|png|tiff?|docx?)$/i;
const MAX_BYTES = 25 * 1024 * 1024;

/** How far back the very first run looks. Enough to prove the pipeline works
 *  without burying the queue in a year of history; the certification backfill
 *  is a separate, deliberate import. */
const FIRST_RUN_DAYS = 30;

/**
 * @param {{db: FirebaseFirestore.Firestore, bucket: any}} ctx
 * @param {{tenantId: string, clientId: string, clientSecret: string, mailbox: string}} cfg
 * @param {{budgetMs?: number, maxMessages?: number, graph?: object}} [opts]
 *
 * `opts.graph` exists so this can be run against a stand-in mailbox. The whole
 * pipeline downstream of Graph — classify, match, dedupe, watermark, budget —
 * is the part that can be wrong in ways nobody notices, and it should not need
 * a tenant, a client secret and real PHI to exercise. See `dryrun.mjs`.
 */
export async function pollMailbox(ctx, cfg, opts = {}) {
  const { db } = ctx;
  const { budgetMs = 8000, maxMessages = 25, graph = realGraph } = opts;
  const { getToken, listMessagesSince, listAttachments } = graph;
  const startedAt = Date.now();
  const spent = () => Date.now() - startedAt;

  if (!cfg.mailbox) {
    // Configured wrong rather than idle. Say so loudly — a quiet queue is
    // indistinguishable from a working one until a survey.
    throw new Error("DTC_MAILBOX is not set; the poll has nothing to watch.");
  }

  const stateRef = db.collection("metadata").doc("ingestion");
  const state = (await stateRef.get()).data() || {};
  const since =
    state.outlookWatermark || new Date(Date.now() - FIRST_RUN_DAYS * 864e5).toISOString();

  const token = await getToken(cfg);
  const roster = await loadRoster(db);
  // Inbox only. Graph's `/messages` covers the whole mailbox — Sent Items,
  // Deleted Items, Clutter — so an unscoped read would queue every attachment
  // the agency sent *out* as though it had just arrived, and file DTC's own
  // outgoing paperwork back onto the records of the people it was about.
  const messages = await listMessagesSince(token, cfg.mailbox, since, maxMessages, "inbox");

  let queued = 0;
  let processed = 0;
  let watermark = since;
  let stoppedEarly = null;

  for (const msg of messages) {
    if (spent() > budgetMs) {
      // Out of time, not out of work. The next run resumes from here.
      stoppedEarly = "time budget";
      break;
    }
    try {
      if (msg.hasAttachments) {
        const attachments = await listAttachments(token, cfg.mailbox, msg.id);
        for (const att of attachments) {
          if (!KEEP.test(att.name || "")) continue;
          if (att.size > MAX_BYTES) {
            console.warn(`Skipping oversized attachment ${att.name} (${att.size} bytes)`);
            continue;
          }
          await enqueue(
            { ...ctx, roster },
            {
              source: "email",
              // Stable across re-polls: the same attachment on the same message
              // always produces the same key, so a watermark that slips
              // backwards cannot duplicate the queue.
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
      processed++;
    } catch (err) {
      // Stop at the first failure rather than skipping past it. Advancing over
      // a message we could not read would lose it silently, and a referral that
      // never arrives is worse than a poll that retries.
      console.error(`Failed on message ${msg.id}; stopping this run.`, err);
      stoppedEarly = `error on message ${msg.id}`;
      break;
    }
  }

  await stateRef.set(
    {
      outlookWatermark: watermark,
      lastPollAt: new Date().toISOString(),
      lastQueued: queued,
      lastProcessed: processed,
      lastStoppedEarly: stoppedEarly,
      lastDurationMs: spent(),
    },
    { merge: true },
  );

  return { queued, processed, watermark, stoppedEarly, durationMs: spent() };
}

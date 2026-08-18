// What actually happens in the DTC mailbox?
//
//     node survey.mjs            (from functions/, with the Graph vars set)
//     node survey.mjs --days 180
//
// Read-only. It writes nothing, anywhere — not to Firestore, not to Storage,
// not back to Outlook. It never downloads an attachment's contents, only its
// name, type and size. It prints counts and shapes, never a person's name and
// never the body of an email.
//
// It exists because of a specific question nobody could answer from memory:
// **do documents arrive that have to be signed and sent back, and if so, how?**
// Building a signing-and-return pipeline for something that happens twice a
// year would be the most expensive possible mistake here, and building nothing
// when it happens weekly would be the second most expensive. So: count it.
//
// The method is simple. Outlook threads messages by `conversationId`. A
// conversation that has an inbound message with an attachment *and* a reply
// from DTC with an attachment is, almost always, a document that came in, got
// worked on, and went back out. That pattern is the answer.
//
// This is also a good first use of the Graph credential — it proves the whole
// connection works while being incapable of changing anything.

import { getToken, listAllInFolder, listAttachmentMeta } from "./src/graph.mjs";

const cfg = {
  tenantId: process.env.GRAPH_TENANT_ID,
  clientId: process.env.GRAPH_CLIENT_ID,
  clientSecret: process.env.GRAPH_CLIENT_SECRET,
  mailbox: process.env.DTC_MAILBOX,
};

const days = Number(process.argv[argIndex("--days") + 1]) || 90;
function argIndex(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? -Infinity : i;
}

const DOC_EXT = /\.(pdf|jpe?g|png|tiff?|docx?|xlsx?)$/i;
const ext = (name) => (String(name).match(DOC_EXT)?.[1] || "other").toLowerCase().replace("jpeg", "jpg");

// Wording that suggests something is expected back. Deliberately generous — a
// false positive costs a glance, a false negative hides the whole feature.
const ASK_BACK =
  /\bsign(ed|ature)?\b|\bcountersign|\bexecute[d]?\b|\breturn (it|this|the)|\bsend (it |this )?back|\bcomplete and return|\backnowledg/i;
const CONFIRMED =
  /\breceived\b|\bconfirm(ed|ation)?\b|\bthank you\b|\bgot it\b|\ball set\b|\bapproved\b/i;

function pct(n, total) {
  return total ? `${Math.round((n / total) * 100)}%` : "0%";
}

function histogram(counts, width = 24) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;
  return entries.map(
    ([k, v]) => `    ${k.padEnd(10)} ${"█".repeat(Math.max(1, Math.round((v / max) * width)))} ${v}`,
  );
}

async function main() {
  const missing = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(
      `\n  Missing: ${missing.join(", ")}\n\n` +
        `  This needs the Graph credential from GOING-LIVE.md steps 1-2.\n` +
        `  It reads the mailbox and writes nothing, so it is safe to run\n` +
        `  before anything else is configured.\n`,
    );
    process.exit(1);
  }

  const since = new Date(Date.now() - days * 864e5).toISOString();
  console.log(`\n  DTC mailbox survey — ${cfg.mailbox}`);
  console.log("  " + "─".repeat(70));
  console.log(`  Window: last ${days} days (since ${since.slice(0, 10)})`);
  console.log("  Read-only. No attachment contents are downloaded. Nothing is written.\n");

  const token = await getToken(cfg);
  const [inbox, sent] = await Promise.all([
    listAllInFolder(token, cfg.mailbox, "inbox", since),
    // Sent Items is the whole point. Without it there is no way to see whether
    // anything ever goes back out, which is the question being asked.
    listAllInFolder(token, cfg.mailbox, "sentitems", since).catch(() => []),
  ]);

  console.log(`  ${inbox.length} received · ${sent.length} sent\n`);

  // ── What arrives ────────────────────────────────────────────────────────
  const inboundWithAtt = inbox.filter((m) => m.hasAttachments);
  const formats = {};
  let attachmentCount = 0;

  for (const m of inboundWithAtt) {
    const atts = await listAttachmentMeta(token, cfg.mailbox, m.id).catch(() => []);
    for (const a of atts) {
      attachmentCount++;
      formats[ext(a.name)] = (formats[ext(a.name)] || 0) + 1;
    }
  }

  console.log("  WHAT ARRIVES");
  console.log(
    `    ${inboundWithAtt.length} of ${inbox.length} messages carry attachments (${pct(inboundWithAtt.length, inbox.length)})`,
  );
  console.log(`    ${attachmentCount} attachments in total, by format:\n`);
  console.log(histogram(formats).join("\n"));
  console.log("");
  // Every format other than pdf is a separate signing problem, so the split
  // matters more than the total.
  const nonPdf = attachmentCount - (formats.pdf || 0);
  console.log(
    `    ${formats.pdf || 0} PDF · ${nonPdf} not PDF (${pct(nonPdf, attachmentCount)})` +
      (nonPdf ? " — each non-PDF format is its own signing problem\n" : "\n"),
  );

  // ── Does anything go back out? ──────────────────────────────────────────
  const sentByConv = new Map();
  for (const m of sent) {
    if (!m.conversationId) continue;
    sentByConv.set(m.conversationId, [...(sentByConv.get(m.conversationId) || []), m]);
  }

  const replied = [];
  const repliedWithAttachment = [];
  const askedForSignature = [];

  for (const m of inboundWithAtt) {
    const text = `${m.subject || ""} ${m.bodyPreview || ""}`;
    if (ASK_BACK.test(text)) askedForSignature.push(m);

    const replies = (sentByConv.get(m.conversationId) || []).filter(
      (r) => (r.sentDateTime || r.receivedDateTime) > m.receivedDateTime,
    );
    if (!replies.length) continue;
    replied.push(m);
    // The signal. Something came in, and something went back out attached to
    // the same thread. That is a document that was worked on and returned.
    if (replies.some((r) => r.hasAttachments)) repliedWithAttachment.push({ m, replies });
  }

  console.log("  DOES ANYTHING GO BACK OUT?");
  console.log(
    `    ${replied.length} of ${inboundWithAtt.length} threads got any reply from DTC (${pct(replied.length, inboundWithAtt.length)})`,
  );
  console.log(
    `    ${repliedWithAttachment.length} got a reply that itself had an attachment (${pct(repliedWithAttachment.length, inboundWithAtt.length)})`,
  );
  console.log(
    `    ${askedForSignature.length} incoming messages use words like sign / return / acknowledge\n`,
  );

  if (repliedWithAttachment.length) {
    console.log("    The document-went-back-out cases — this is the feature, if it exists:\n");
    for (const { m, replies } of repliedWithAttachment.slice(0, 15)) {
      console.log(`      in   ${m.receivedDateTime.slice(0, 10)}  ${(m.subject || "(no subject)").slice(0, 52)}`);
      for (const r of replies.filter((x) => x.hasAttachments).slice(0, 2)) {
        const atts = await listAttachmentMeta(token, cfg.mailbox, r.id).catch(() => []);
        console.log(
          `      out  ${String(r.sentDateTime || "").slice(0, 10)}  ${atts.map((a) => a.name).join(", ").slice(0, 60)}`,
        );
      }
      console.log("");
    }
    if (repliedWithAttachment.length > 15) {
      console.log(`      … and ${repliedWithAttachment.length - 15} more\n`);
    }
  } else {
    console.log(
      "    Nothing went back out with an attachment in this window.\n" +
        "    On this evidence, sign-and-return is not a thing the mailbox does.\n",
    );
  }

  // ── Confirmations ───────────────────────────────────────────────────────
  const confirmations = inbox.filter(
    (m) => !m.hasAttachments && CONFIRMED.test(`${m.subject || ""} ${m.bodyPreview || ""}`),
  );
  const noAttachment = inbox.length - inboundWithAtt.length;

  console.log("  THE REST OF THE MAILBOX");
  console.log(`    ${noAttachment} messages arrived with no attachment at all (${pct(noAttachment, inbox.length)})`);
  console.log(`    ${confirmations.length} of those read like confirmations or acknowledgements`);
  console.log(
    "    Today the poll ignores all of these — it only queues attachments.\n" +
      "    The owner said some referrals are one-line 'call this person' emails,\n" +
      "    and those are in this pile.\n",
  );

  // ── The read ────────────────────────────────────────────────────────────
  console.log("  " + "─".repeat(70));
  console.log("  WHAT THIS SUGGESTS\n");

  const rate = inboundWithAtt.length ? repliedWithAttachment.length / inboundWithAtt.length : 0;
  const perMonth = (repliedWithAttachment.length / days) * 30;

  if (repliedWithAttachment.length === 0) {
    console.log("    No sign-and-return traffic found. Filing is the job; building a");
    console.log("    signing pipeline would be building for a case that isn't happening.");
  } else if (perMonth < 2) {
    console.log(`    About ${perMonth.toFixed(1)} a month. Real, but rare enough that the`);
    console.log("    manual loop is probably cheaper than a feature. Worth revisiting");
    console.log("    if the number climbs.");
  } else {
    console.log(`    About ${perMonth.toFixed(1)} a month (${pct(repliedWithAttachment.length, inboundWithAtt.length)} of documents received).`);
    console.log("    That is a real workflow. Look at the formats above — if they are");
    console.log("    mostly PDF, the narrow version is worth scoping.");
  }
  console.log("");
  console.log("    Read the sampled subjects above rather than trusting the counts.");
  console.log("    The word-matching is crude and a reply with an attachment might be");
  console.log("    a forward, not a signed return.\n");
}

main().catch((err) => {
  console.error("\n  Survey failed:", err?.message || err);
  if (err?.status === 403) {
    console.error(
      "  A 403 usually means admin consent was never granted, or the\n" +
        "  application access policy excludes this mailbox. See GOING-LIVE.md step 2.\n",
    );
  }
  process.exit(1);
});

// Run the whole ingestion pipeline against the real roster and a stand-in
// mailbox, and print what it would have put in front of a reviewer.
//
//     npm run dryrun            (from functions/)
//
// Nothing is written anywhere. No Firebase, no Microsoft Graph, no credentials,
// no network. The rosters are the real ones from migration/*.json — 30 clients
// and 35 staff, including every collision that matters — and the mailbox is a
// set of filenames modelled on what the agency actually receives.
//
// The point is to be able to see the matcher's judgement before wiring a live
// mailbox to it. The expensive mistake in this system is not a crash; it is a
// document filed confidently against the wrong Hardman, and that is only
// visible by reading the output.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { pollMailbox } from "./src/poll.mjs";
import { fakeDb, fakeBucket, fakeGraph, message } from "./test/fakes.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const migration = join(here, "..", "migration");

const read = (f) => JSON.parse(readFileSync(join(migration, f), "utf8"));

// Shape the migration extracts the way loadRoster expects to find them in
// Firestore: clients keyed by id, staff under users.
function seedFromMigration() {
  const clients = {};
  read("caretime-clients.json").clients.forEach((c, i) => {
    clients[`client-${i}`] = { name: c.name };
  });

  const users = {};
  read("caretime-staff.json").staff.forEach((s, i) => {
    users[s.caretimeId || `staff-${i}`] = { name: s.name, title: s.title };
  });

  return { clients, users, counts: { clients: Object.keys(clients).length, staff: Object.keys(users).length } };
}

// A mailbox modelled on the real intake. Deliberately unkind: the easy cases
// are here to prove the pipe works, and the rest are the ones that decide
// whether this is safe to point at a live inbox.
const MAILBOX = [
  // — the ordinary day —
  message("m01", "2026-07-20T09:12:00Z", {
    subject: "DCSC authorization",
    from: "coordinator@denverhumanservices.org",
    attachments: [{ id: "a1", name: "DCSC_Auth_Clarence_Archuleta.pdf" }],
  }),
  message("m02", "2026-07-20T14:03:00Z", {
    subject: "CBI results",
    attachments: [{ id: "a1", name: "CBI_result_Amir_Ameen.pdf" }],
  }),
  message("m03", "2026-07-21T08:45:00Z", {
    subject: "CPR card",
    attachments: [{ id: "a1", name: "CPR-certification-Davon-Tolliver.pdf" }],
  }),

  // — the cross-roster collisions, which decide which filing cabinet —
  message("m04", "2026-07-21T11:20:00Z", {
    subject: "Paperwork",
    attachments: [{ id: "a1", name: "D Hardman - start of care.pdf" }],
  }),
  message("m05", "2026-07-22T10:00:00Z", {
    subject: "Documents attached",
    attachments: [{ id: "a1", name: "Carabajal care plan.pdf" }],
  }),
  message("m06", "2026-07-22T15:30:00Z", {
    subject: "Supervisory visit - Rodriguez",
    attachments: [{ id: "a1", name: "90 day visit.pdf" }],
  }),

  // — the worst one: both Tisbys are admins, one owns the agency —
  message("m07", "2026-07-23T09:00:00Z", {
    subject: "TB test",
    attachments: [{ id: "a1", name: "TB_result_Tisby.pdf" }],
  }),

  // — the things that should never reach a reviewer —
  message("m08", "2026-07-23T12:00:00Z", {
    subject: "Re: Fw: checking in",
    attachments: [
      { id: "a1", name: "signature-logo.gif" },
      { id: "a2", name: "case-manager.vcf" },
    ],
  }),
  // A one-line referral with nothing attached — the owner said these are common.
  message("m09", "2026-07-23T16:40:00Z", {
    subject: "New referral - please call",
    body: "Can you call this person about starting services",
  }),

  // — unclassifiable, and unmatched: still a human's problem, not a dropped one —
  message("m10", "2026-07-24T08:15:00Z", {
    subject: "documents",
    attachments: [{ id: "a1", name: "scan0043.pdf" }],
  }),
  message("m11", "2026-07-24T13:00:00Z", {
    subject: "Records request",
    attachments: [{ id: "a1", name: "Certification - Marjorie Whitfield.pdf" }],
  }),
];

const BUCKETS = {
  confident: {
    heading: "CONFIDENT — pre-selected, still needs a click",
    note: "Full first and last name. The reviewer confirms; they do not decide.",
  },
  weak: {
    heading: "WEAK — suggested, never pre-selected",
    note: "A surname and an initial, or a spelling variant. 53 of the 126 GoFormz records look like this.",
  },
  ambiguous: {
    heading: "AMBIGUOUS — nothing pre-selected, on purpose",
    note: "More than one person fits. A tie spanning the two rosters is forced here even when it scores well.",
  },
  unmatched: {
    heading: "UNMATCHED — nobody on the roster fits",
    note: "Often a former client or former staff member, whose records still have to be retained.",
  },
};

function bar(label, n, total, width = 28) {
  const filled = total ? Math.round((n / total) * width) : 0;
  return `${label.padEnd(11)} ${"█".repeat(filled).padEnd(width, "·")} ${String(n).padStart(2)}`;
}

async function main() {
  const { clients, users, counts } = seedFromMigration();
  const db = fakeDb({ clients, users });
  const bucket = fakeBucket();

  console.log("\n  DTC ingestion — dry run");
  console.log("  " + "─".repeat(70));
  console.log(`  Roster:  ${counts.clients} clients, ${counts.staff} staff (from migration/*.json)`);
  console.log(`  Mailbox: ${MAILBOX.length} stand-in messages`);
  console.log("  Nothing is written. No Firebase, no Graph, no credentials.\n");

  const result = await pollMailbox(
    { db, bucket },
    { tenantId: "dry", clientId: "dry", clientSecret: "dry", mailbox: "dryrun@example.invalid" },
    // Generous budget: this is about judgement, not about the free-tier clock.
    { graph: fakeGraph(MAILBOX), budgetMs: 60_000, maxMessages: 100 },
  );

  const entries = db._collection("inbound");
  const grouped = { confident: [], weak: [], ambiguous: [], unmatched: [] };
  for (const e of entries) grouped[e.confidence]?.push(e);

  for (const [key, { heading, note }] of Object.entries(BUCKETS)) {
    const group = grouped[key];
    console.log(`  ${heading}  (${group.length})`);
    console.log(`  ${note}`);
    if (!group.length) console.log("    —");
    for (const e of group) {
      const top = e.candidates?.[0];
      const who = top ? `${top.name} [${top.subjectType}]` : "—";
      console.log(`    ${e.fileName}`);
      console.log(`      ${e.docLabel.padEnd(20)} → ${who}`);
      if (e.matchNote) console.log(`      ${e.matchNote}`);
      if (e.candidates?.length > 1) {
        const others = e.candidates.slice(1).map((c) => `${c.name} [${c.subjectType}]`).join(", ");
        console.log(`      also fits: ${others}`);
      }
    }
    console.log("");
  }

  const total = entries.length;
  console.log("  " + "─".repeat(70));
  console.log("  How the queue would look\n");
  for (const k of Object.keys(BUCKETS)) console.log("  " + bar(k, grouped[k].length, total));

  const needsThought = grouped.ambiguous.length + grouped.unmatched.length + grouped.weak.length;
  console.log(`\n  ${total} queued from ${result.processed} messages in ${result.durationMs}ms`);
  console.log(`  ${grouped.confident.length} need a confirming click; ${needsThought} need a person to think.`);
  console.log(`  Watermark would advance to ${result.watermark}`);
  console.log(`  Stored ${Object.keys(bucket._objects()).length} source documents (in memory).\n`);

  // The attachments that were correctly ignored are worth naming: every one of
  // them would otherwise have cost a reviewer a decision for nothing.
  const offered = MAILBOX.flatMap((m) => m.attachments || []).length;
  console.log(`  Ignored ${offered - total} of ${offered} attachments (logos, vcards, oversized).\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

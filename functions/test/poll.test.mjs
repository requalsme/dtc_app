// The poll, end to end, against a stand-in mailbox.
//
// classify and matcher already have their own tests. What was untested until
// now is everything *around* them — the watermark, the dedupe key, the time
// budget, the attachment filter, and what happens when Graph fails halfway
// through a run. Those are the parts that fail silently: a poll that skips a
// message still returns 200 and still logs "0 queued", which is exactly what a
// genuinely empty mailbox looks like.
//
// Every case below is written against the behaviour README.md promises, so if
// someone changes the code the documentation stops being true out loud.

import { test } from "node:test";
import assert from "node:assert/strict";

import { pollMailbox } from "../src/poll.mjs";
import { fakeDb, fakeBucket, fakeGraph, message } from "./fakes.mjs";

const CFG = {
  tenantId: "t",
  clientId: "c",
  clientSecret: "s",
  mailbox: "intake@daretocarehomecare.com",
};

// A small roster carrying the collisions that actually matter. Debra Hardman
// is a client and Dean Hardman is staff; "D Hardman" is genuinely both, and
// which one wins decides which filing cabinet a document lands in.
const ROSTER_SEED = {
  clients: {
    c1: { name: "Debra Hardman" },
    c2: { name: "Clarence Archuleta" },
    c3: { name: "Flora Carbajal" },
  },
  users: {
    u1: { name: "Dean Hardman" },
    u2: { name: "Amir Ameen" },
    u3: { name: "Ernest Carabajal" },
  },
};

function ctx(seed = {}) {
  const db = fakeDb({ ...structuredClone(ROSTER_SEED), ...seed });
  return { db, bucket: fakeBucket() };
}

test("queues an attachment and records where it came from", async () => {
  const { db, bucket } = ctx();
  const graph = fakeGraph([
    message("m1", "2026-08-01T10:00:00Z", {
      subject: "CBI result",
      attachments: [{ id: "a1", name: "CBI_result_Amir_Ameen.pdf" }],
    }),
  ]);

  const result = await pollMailbox({ db, bucket }, CFG, { graph });

  assert.equal(result.queued, 1);
  assert.equal(result.processed, 1);

  const [entry] = db._collection("inbound");
  assert.equal(entry.source, "email");
  assert.equal(entry.status, "pending");
  assert.equal(entry.docType, "backgroundCheck");
  // The source document is kept, not just the parsed fields. A surveyor wants
  // the PDF, not a row saying "passed".
  assert.ok(entry.sourcePath, "the source document should be stored");
  assert.ok(entry.sourceUrl?.includes("token="), "a download token should be minted");
});

test("a full first-and-last name match is confident; a surname plus initial is not", async () => {
  const { db, bucket } = ctx();
  const graph = fakeGraph([
    message("m1", "2026-08-01T10:00:00Z", {
      attachments: [
        { id: "a1", name: "Care Plan - Clarence Archuleta.pdf" },
        { id: "a2", name: "Care Plan - D Hardman.pdf" },
      ],
    }),
  ]);

  await pollMailbox({ db, bucket }, CFG, { graph });

  const byName = Object.fromEntries(db._collection("inbound").map((e) => [e.fileName, e]));
  assert.equal(byName["Care Plan - Clarence Archuleta.pdf"].confidence, "confident");

  // Debra Hardman (client) and Dean Hardman (staff) both fit. This must never
  // resolve on its own — a wrong answer here files a client's care plan into a
  // caregiver's personnel record.
  assert.notEqual(
    byName["Care Plan - D Hardman.pdf"].confidence,
    "confident",
    "a cross-roster surname collision must not be confident",
  );
});

test("the watermark advances only past messages that fully succeeded", async () => {
  const { db, bucket } = ctx();
  const graph = fakeGraph(
    [
      message("m1", "2026-08-01T10:00:00Z", {
        attachments: [{ id: "a1", name: "Care Plan - Clarence Archuleta.pdf" }],
      }),
      message("m2", "2026-08-01T11:00:00Z", {
        attachments: [{ id: "a2", name: "DCSC authorization.pdf" }],
      }),
      message("m3", "2026-08-01T12:00:00Z", {
        attachments: [{ id: "a3", name: "CPR cert - Amir Ameen.pdf" }],
      }),
    ],
    { failOnMessageId: "m2" },
  );

  const result = await pollMailbox({ db, bucket }, CFG, { graph });

  assert.match(result.stoppedEarly, /error on message m2/);
  // Stopped at m2, so the watermark sits at m1. m2 and m3 are retried next run.
  assert.equal(result.watermark, "2026-08-01T10:00:00Z");
  assert.equal(result.processed, 1);

  const state = (await db.collection("metadata").doc("ingestion").get()).data();
  assert.equal(state.outlookWatermark, "2026-08-01T10:00:00Z");
});

test("a second run resumes from the watermark and re-queues nothing", async () => {
  const { db, bucket } = ctx();
  const messages = [
    message("m1", "2026-08-01T10:00:00Z", {
      attachments: [{ id: "a1", name: "Care Plan - Clarence Archuleta.pdf" }],
    }),
  ];

  const first = await pollMailbox({ db, bucket }, CFG, { graph: fakeGraph(messages) });
  const second = await pollMailbox({ db, bucket }, CFG, { graph: fakeGraph(messages) });

  assert.equal(first.queued, 1);
  assert.equal(second.queued, 0, "the watermark should exclude an already-seen message");
  assert.equal(db._collection("inbound").length, 1);
});

test("re-queueing the same attachment updates one entry rather than duplicating it", async () => {
  const { db, bucket } = ctx();
  const messages = [
    message("m1", "2026-08-01T10:00:00Z", {
      attachments: [{ id: "a1", name: "Care Plan - Clarence Archuleta.pdf" }],
    }),
  ];

  await pollMailbox({ db, bucket }, CFG, { graph: fakeGraph(messages) });
  // Simulate a watermark that slipped backwards — a redeploy, a restored
  // backup, a manual reset. The dedupe key is what makes that survivable.
  await db.collection("metadata").doc("ingestion").set({ outlookWatermark: "2026-01-01T00:00:00Z" });
  await pollMailbox({ db, bucket }, CFG, { graph: fakeGraph(messages) });

  assert.equal(db._collection("inbound").length, 1, "same document, same entry");
});

test("an entry a person has already resolved is never queued back", async () => {
  const { db, bucket } = ctx();
  const messages = [
    message("m1", "2026-08-01T10:00:00Z", {
      attachments: [{ id: "a1", name: "Care Plan - Clarence Archuleta.pdf" }],
    }),
  ];

  await pollMailbox({ db, bucket }, CFG, { graph: fakeGraph(messages) });
  const [entry] = db._collection("inbound");
  await db.collection("inbound").doc(entry.id).update({ status: "resolved" });

  await db.collection("metadata").doc("ingestion").set({ outlookWatermark: "2026-01-01T00:00:00Z" });
  await pollMailbox({ db, bucket }, CFG, { graph: fakeGraph(messages) });

  const after = db._collection("inbound");
  assert.equal(after.length, 1);
  assert.equal(after[0].status, "resolved", "a resolved decision must not be reopened");
});

test("signature logos, vcards and oversized files never reach a reviewer", async () => {
  const { db, bucket } = ctx();
  const graph = fakeGraph([
    message("m1", "2026-08-01T10:00:00Z", {
      attachments: [
        { id: "a1", name: "logo.gif" },
        { id: "a2", name: "contact.vcf" },
        { id: "a3", name: "huge-scan.pdf", size: 40 * 1024 * 1024 },
        { id: "a4", name: "Care Plan - Clarence Archuleta.pdf" },
      ],
    }),
  ]);

  const result = await pollMailbox({ db, bucket }, CFG, { graph });

  assert.equal(result.queued, 1, "only the real document should be queued");
  assert.equal(db._collection("inbound")[0].fileName, "Care Plan - Clarence Archuleta.pdf");
});

test("the time budget stops the run politely instead of being killed", async () => {
  const { db, bucket } = ctx();
  const graph = fakeGraph(
    [
      message("m1", "2026-08-01T10:00:00Z", {
        attachments: [{ id: "a1", name: "Care Plan - Clarence Archuleta.pdf" }],
      }),
      message("m2", "2026-08-01T11:00:00Z", {
        attachments: [{ id: "a2", name: "CPR cert - Amir Ameen.pdf" }],
      }),
      message("m3", "2026-08-01T12:00:00Z", {
        attachments: [{ id: "a3", name: "DCSC - Flora Carbajal.pdf" }],
      }),
    ],
    { delayMs: 40 },
  );

  const result = await pollMailbox({ db, bucket }, CFG, { graph, budgetMs: 50 });

  assert.equal(result.stoppedEarly, "time budget");
  assert.ok(result.processed >= 1 && result.processed < 3, "some work done, not all");
  // Whatever it got through is durable: the next run picks up from there.
  assert.ok(result.watermark > "2026-08-01T09:00:00Z");
});

test("an unset mailbox fails loudly rather than looking like an empty inbox", async () => {
  const { db, bucket } = ctx();
  await assert.rejects(
    () => pollMailbox({ db, bucket }, { ...CFG, mailbox: "" }, { graph: fakeGraph([]) }),
    /DTC_MAILBOX is not set/,
  );
});

test("mail the agency sent is never treated as mail that arrived", async () => {
  const { db, bucket } = ctx();
  const graph = fakeGraph([
    message("m1", "2026-08-01T10:00:00Z", {
      subject: "Referral received",
      attachments: [{ id: "a1", name: "DCSC - Clarence Archuleta.pdf" }],
    }),
    // The reply DTC sent back, carrying the same document. Graph's
    // `/users/{id}/messages` returns the whole mailbox — Sent Items, Deleted
    // Items, Clutter — so without folder scoping this queues a second time and
    // the agency's own outgoing paperwork lands back on someone's record.
    message("m2", "2026-08-01T14:00:00Z", {
      folder: "sentitems",
      subject: "RE: Referral received",
      attachments: [{ id: "a2", name: "DCSC - Clarence Archuleta signed.pdf" }],
    }),
  ]);

  const result = await pollMailbox({ db, bucket }, CFG, { graph });

  assert.deepEqual(graph.calls.folders, ["inbox"], "the poll must ask for the inbox by name");
  assert.equal(result.queued, 1);
  assert.equal(db._collection("inbound")[0].fileName, "DCSC - Clarence Archuleta.pdf");
});

test("a document nobody can classify is still queued for a human", async () => {
  const { db, bucket } = ctx();
  const graph = fakeGraph([
    message("m1", "2026-08-01T10:00:00Z", {
      subject: "Re: Fw: documents",
      attachments: [{ id: "a1", name: "scan0043.pdf" }],
    }),
  ]);

  const result = await pollMailbox({ db, bucket }, CFG, { graph });

  assert.equal(result.queued, 1);
  const [entry] = db._collection("inbound");
  assert.equal(entry.docType, "unknown");
  assert.equal(entry.confidence, "unmatched");
});

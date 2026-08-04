// Matcher tests, run against the real rosters rather than invented names.
//
// The cases below are taken from three places: the GoFormz title formats
// inventoried on 2026-08-04, the surname collisions that actually exist on the
// CareTime rosters, and the spelling variants found between the two systems.
// Invented test data would not have caught Carbajal/Carabajal.
//
//   node --test functions/test/

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { matchName, tokenize, isPreselectable } from "../src/matcher.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const migration = join(here, "..", "..", "migration");

const slug = (name) => name.toLowerCase().replace(/[^a-z]+/g, "-");

const clients = JSON.parse(
  readFileSync(join(migration, "caretime-clients.json"), "utf8"),
).clients.map((c) => ({ id: `client-${slug(c.name)}`, name: c.name, subjectType: "client" }));

const staff = JSON.parse(
  readFileSync(join(migration, "caretime-staff.json"), "utf8"),
).staff.map((s) => ({ id: s.caretimeId, name: s.name, subjectType: "staff" }));

const roster = [...clients, ...staff];

const top = (r) => r.candidates[0];

// ─── The rosters are what we think they are ────────────────────────────────

test("rosters load with the expected shape", () => {
  assert.equal(clients.length, 30);
  assert.equal(staff.length, 35);
});

// ─── Full names identify ───────────────────────────────────────────────────

test("a full name on the client roster is confident", () => {
  const r = matchName("Hardman, Debra Care Plan", roster);
  assert.equal(r.confidence, "confident");
  assert.equal(top(r).name, "Debra Hardman");
  assert.equal(top(r).subjectType, "client");
  assert.ok(isPreselectable(r));
});

test("a full name on the staff roster is confident", () => {
  const r = matchName("Rushane Harris signed acknowledgement", roster);
  assert.equal(r.confidence, "confident");
  assert.equal(top(r).name, "Rushane Harris");
  assert.equal(top(r).subjectType, "staff");
});

test("dates and form words in the title do not prevent a match", () => {
  const r = matchName("Shannon Coffey Client Care Plan 072426.pdf", roster);
  assert.equal(r.confidence, "confident");
  assert.equal(top(r).name, "Shannon Coffey");
});

// ─── Surname plus an initial never identifies ──────────────────────────────

test("surname and initial is weak, not confident", () => {
  const r = matchName("Coffey S Client Care Plan 072426", roster);
  assert.equal(r.confidence, "weak");
  assert.equal(top(r).name, "Shannon Coffey");
  assert.ok(!isPreselectable(r));
});

test("initial-first GoFormz format is weak", () => {
  const r = matchName("T Phillips_Client Care Plan", roster);
  assert.equal(r.confidence, "weak");
  assert.equal(top(r).name, "Terrie Phillips");
});

test("surname with no first name at all is weak", () => {
  const r = matchName("Robinson DA_Supervisory Visit", roster);
  assert.equal(r.confidence, "weak");
  assert.equal(top(r).name, "Debra Ann Robinson");
});

// ─── Collisions within one roster ──────────────────────────────────────────

test("two staff sharing a surname is ambiguous", () => {
  const r = matchName("Harris CBI result", roster);
  assert.equal(r.confidence, "ambiguous");
  const names = r.candidates.map((c) => c.name);
  assert.ok(names.includes("Rushane Harris"));
  assert.ok(names.includes("Yvonne Harris"));
});

test("Martinez is ambiguous between Louisa and Mark", () => {
  const r = matchName("Martinez background check", roster);
  assert.equal(r.confidence, "ambiguous");
});

test("Tisby is ambiguous between Kevan and Rejane", () => {
  const r = matchName("Tisby signature", roster);
  assert.equal(r.confidence, "ambiguous");
});

test("two clients sharing a surname is ambiguous", () => {
  const r = matchName("Hunter Care Plan", roster);
  assert.equal(r.confidence, "ambiguous");
  const names = r.candidates.map((c) => c.name);
  assert.ok(names.includes("Deonshay Hunter"));
  assert.ok(names.includes("Frances Hunter"));
});

// ─── Collisions across the two rosters — the filing-cabinet error ──────────

test("a shared surname across client and staff is ambiguous", () => {
  const r = matchName("Vuong authorization", roster);
  assert.equal(r.confidence, "ambiguous");
  const types = new Set(r.candidates.slice(0, 2).map((c) => c.subjectType));
  assert.deepEqual([...types].sort(), ["client", "staff"]);
});

test("D Hardman is ambiguous across the client and staff rosters", () => {
  // Debra Hardman is a client; Dean Hardman is a caregiver. Same initial.
  const r = matchName("D Hardman 90 day supervisory visit", roster);
  assert.equal(r.confidence, "ambiguous");
  assert.match(r.note, /client file and a staff file/);
});

test("Rodriguez is ambiguous across rosters", () => {
  const r = matchName("Rodriguez care plan review", roster);
  assert.equal(r.confidence, "ambiguous");
});

test("Richardson is ambiguous across rosters", () => {
  const r = matchName("Richardson form", roster);
  assert.equal(r.confidence, "ambiguous");
});

test("a full name still resolves cleanly despite a same-surname collision", () => {
  const r = matchName("Long Vuong Client Care Plan", roster);
  assert.equal(r.confidence, "confident");
  assert.equal(top(r).name, "Long Vuong");
  assert.equal(top(r).subjectType, "client");
});

test("Debra Hardman outranks Dean Hardman when the first name is given", () => {
  const r = matchName("Debra Hardman Care Plan", roster);
  assert.equal(r.confidence, "confident");
  assert.equal(top(r).name, "Debra Hardman");
});

// ─── Spelling variants between GoFormz and CareTime ────────────────────────

test("Edmundson matches Edmondson but only weakly", () => {
  const r = matchName("T Edmundson Client Care Plan", roster);
  assert.equal(top(r).name, "Terry Edmondson");
  assert.notEqual(r.confidence, "confident");
});

test("Sisineros matches Sisneros", () => {
  const r = matchName("Tammy Sisineros supervisory visit", roster);
  assert.equal(top(r).name, "Tammy Sisneros");
  assert.notEqual(r.confidence, "confident");
});

test("Roderiguez is ambiguous because both Rodriguezes are variants", () => {
  const r = matchName("Roderiguez care plan", roster);
  assert.equal(r.confidence, "ambiguous");
});

test("Carbajal and Carabajal are one letter apart on different rosters", () => {
  // Flora Carbajal is a client; Ernest Carabajal is a caregiver.
  const full = matchName("Flora Carbajal Client Care Plan", roster);
  assert.equal(full.confidence, "confident");
  assert.equal(top(full).name, "Flora Carbajal");
  assert.equal(top(full).subjectType, "client");

  const initial = matchName("E Carabajal background check", roster);
  assert.notEqual(initial.confidence, "confident");
  assert.equal(top(initial).name, "Ernest Carabajal");
});

// ─── Compound surnames ─────────────────────────────────────────────────────

test("half of a hyphenated surname does not outrank the whole surname", () => {
  // Liborio Coria and Lovenus Ruiz-Coria are both caregivers.
  const r = matchName("Coria timesheet", roster);
  assert.notEqual(r.confidence, "confident");
  assert.equal(top(r).name, "Liborio Coria");
  assert.ok(r.candidates.some((c) => c.name === "Lovenus Ruiz-Coria"));
});

test("a hyphenated surname matches when written in full", () => {
  const r = matchName("Lovenus Ruiz-Coria new hire packet", roster);
  assert.equal(r.confidence, "confident");
  assert.equal(top(r).name, "Lovenus Ruiz-Coria");
});

test("a hyphenated client surname matches", () => {
  const r = matchName("Angel Carter-Carroll admission", roster);
  assert.equal(r.confidence, "confident");
  assert.equal(top(r).name, "Angel Carter-Carroll");
});

// ─── Nothing to go on ──────────────────────────────────────────────────────

test("a form with no name in the title matches nobody", () => {
  const r = matchName("Workplace Violence Policy Acknowledgement", roster);
  assert.equal(r.confidence, "unmatched");
  assert.equal(r.candidates.length, 0);
});

test("a former client is unmatched, with a note explaining why", () => {
  const r = matchName("_Belem Diaz 032526 Care Plan", roster);
  assert.equal(r.confidence, "unmatched");
  assert.match(r.note, /former client or former member of staff/);
});

test("a bare first name identifies nobody", () => {
  // Two clients are called Angel.
  const r = matchName("Angel", roster);
  assert.equal(r.confidence, "unmatched");
});

// ─── The document-type hint is a nudge, not a rule ─────────────────────────

test("the expect hint never overturns a full-name match on the other roster", () => {
  // Supervisory visits file under the client even though a caregiver signs.
  const r = matchName("Dean Hardman", roster, { expect: "client" });
  assert.equal(top(r).name, "Dean Hardman");
  assert.equal(top(r).subjectType, "staff");
});

test("the expect hint breaks a cross-roster tie only into ambiguity, never confidence", () => {
  const r = matchName("Vuong", roster, { expect: "client" });
  assert.notEqual(r.confidence, "confident");
});

// ─── Tokenising ────────────────────────────────────────────────────────────

test("dates are stripped in every format seen in the wild", () => {
  for (const s of ["072426", "03-25-26", "2026/07/24", "7.24.26"]) {
    assert.deepEqual(tokenize(`Coffey ${s}`).tokens, ["coffey"]);
  }
});

test("email reply prefixes are stripped", () => {
  assert.deepEqual(tokenize("RE: FW: Authorization for Curtis Fox").tokens, ["curtis", "fox"]);
});

test("hyphenated names survive tokenising", () => {
  const { tokens, compounds } = tokenize("Yolanda Loyd-Cameron");
  assert.deepEqual(tokens, ["yolanda", "loyd", "cameron"]);
  assert.deepEqual(compounds, ["loydcameron"]);
});

// ─── The property that matters most ────────────────────────────────────────

test("no surname-only string is ever preselectable", () => {
  const surnames = [...new Set(roster.map((p) => p.name.split(" ").pop()))];
  for (const surname of surnames) {
    const r = matchName(surname, roster);
    assert.ok(
      !isPreselectable(r),
      `"${surname}" alone was preselectable — it must not be`,
    );
  }
});

test("every full roster name matches itself and only itself", () => {
  for (const person of roster) {
    const r = matchName(person.name, roster);
    assert.equal(
      top(r).id,
      person.id,
      `"${person.name}" ranked ${top(r).name} first`,
    );
    assert.equal(
      r.confidence,
      "confident",
      `"${person.name}" did not resolve confidently against itself`,
    );
  }
});

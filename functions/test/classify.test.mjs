// Classification tests.
//
// The bar here is lower than for the matcher: a wrong label costs a reviewer a
// moment's confusion, while a wrong name costs a misfiled clinical document.
// What these tests actually protect is the two places classification is load-
// bearing — the `expect` hint fed to the matcher, and the promise that an
// unrecognised document still reaches the queue rather than being dropped.
//
//   node --test functions/test/

import test from "node:test";
import assert from "node:assert/strict";

import { classify, labelFor } from "../src/classify.mjs";

test("a DCSC authorization is recognised and expects a client", () => {
  const r = classify({ subject: "DCSC for Curtis Fox", fileName: "dcsc.pdf" });
  assert.equal(r.docType, "dcsc");
  assert.equal(r.expect, "client");
});

test("a start-of-care form is recognised in either spelling", () => {
  assert.equal(classify({ subject: "SOA needs signature" }).docType, "soa");
  assert.equal(classify({ subject: "Start of Care - Mary Canning" }).docType, "soa");
});

test("a CBI result expects a member of staff", () => {
  const r = classify({ fileName: "CBI_result_Ameen.pdf" });
  assert.equal(r.docType, "backgroundCheck");
  assert.equal(r.expect, "staff");
});

test("certifications expect staff", () => {
  for (const name of ["CPR_card.pdf", "first aid certificate.jpg", "TB test result.pdf"]) {
    const r = classify({ fileName: name });
    assert.equal(r.expect, "staff", `${name} should expect staff`);
  }
});

test("a supervisory visit expects a CLIENT, not the caregiver who signed it", () => {
  // The owner decided this deliberately: the compliance test is whether it has
  // been done every three months for that particular person, so it files under
  // the client even though a caregiver performs and signs it.
  const r = classify({ fileName: "Robinson DA_Supervisory Visit.pdf" });
  assert.equal(r.docType, "supervisoryVisit");
  assert.equal(r.expect, "client");
});

test("the filename beats the subject line", () => {
  // "Re: Fw: documents" says nothing; the attachment name says everything.
  const r = classify({ subject: "Re: Fw: documents", fileName: "CBI clearance.pdf" });
  assert.equal(r.docType, "backgroundCheck");
  assert.equal(r.matchedOn, "fileName");
});

test("only the opening of a long body is considered", () => {
  const r = classify({
    subject: "hello",
    body: "Nothing relevant here. " + "padding ".repeat(200) + "background check",
  });
  assert.equal(r.docType, "unknown");
});

test("an unrecognised document is unknown, with no roster hint", () => {
  const r = classify({ subject: "Lunch on Thursday?", fileName: "menu.pdf" });
  assert.equal(r.docType, "unknown");
  assert.equal(r.expect, null);
  assert.equal(r.label, "Unclassified");
});

test("empty input does not throw", () => {
  const r = classify({});
  assert.equal(r.docType, "unknown");
  assert.equal(classify().docType, "unknown");
});

test("labelFor round-trips every known type", () => {
  for (const type of ["dcsc", "soa", "referral", "backgroundCheck", "certification", "carePlan", "supervisoryVisit"]) {
    assert.notEqual(labelFor(type), "Unclassified", `${type} has no label`);
  }
  assert.equal(labelFor("nonsense"), "Unclassified");
});

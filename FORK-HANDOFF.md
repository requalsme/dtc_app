# Fork handoff — state of the DTC system

_Written 2026-08-04, at commit `d5d3ed0` on `main`._

Everything below is built, verified and pushed. Two forks are ready to start;
this is what each needs to know so it doesn't re-derive it or contradict it.

---

## What exists today

**Repo:** `C:\dev\dtc-app` → github.com/requalsme/dtc_app → Netlify →
forms.daretocarehomecare.com. Moved out of OneDrive, which was breaking git and
the build.

**33 forms, 370 fields.** Built verbatim from the two July-27 source packets —
New Hire (30pp, 12 forms) and Client Admission (29pp, 10 forms) — plus the
standalone forms. All reachable from the admin library, all role-gated.

**Filing.** Every completed form generates a PDF and files itself under the
person it belongs to: client-subject forms on the client's record, staff-subject
forms on the signer's. Immutable and versioned — a correction files alongside
the original rather than over it. Path:
`filed/{client|staff}/{subjectId}/{submissionId}__{timestamp}.pdf`

**Recurring compliance.** Completing a repeating task schedules the next one.
Intervals count from the *due* date, not the completion date, so late work
doesn't drift the schedule. 90-day supervisory visits and yearly care plans.

**Hiring gate.** Training is locked until (1) the packet is signed and (2) an
office manager releases it. Closed at four points: nav link, per-module buttons,
handoff-token minting, and the release button itself. "Verify & hire on"
promotes newHire → caregiver, stamped with who did it.

**Permissions.** Templates admin-only. Submissions must be created stamped and
`submitted`; only office manager and above can edit one afterwards, except the
author fixing a `needsCorrection`. No deletes anywhere.

## Verified

```
forms 33 · fields 370 · library 33 · unreachable 0 · schema problems 0
gate choke points 4/4 · packet keys 12/12 resolve
security rules 7/7 · filing pipeline 5/5
migration: 30 clients, 35 staff, 0 dup emails, 0 bad emails, 0 unmapped titles
tsc clean
```

## Not done — and why

| Item | Blocker |
|---|---|
| Deploy security rules | Needs your Firebase login. `DEPLOY-RULES.bat` does it. **Storage is still on console defaults** — do this before real PHI is filed. |
| Run the migration | Needs a Firebase service-account key. See `migration/README.md`. Dry-run first. |
| Import GoFormz history | 126 records inventoried in `migration/goformz-inventory.md`. Matching is too weak to auto-file — 53 of 126 match only on surname + one initial. Needs a review queue. |
| Visual QA | Never rendered. Run `RUN-DTC-APP.bat` → localhost:5180. |

---

# Fork 1 — Email agent

**Scope:** watch the DTC Outlook, extract SOA/DCSC authorizations and
certification results, file them against the right person.

**Start from `OWNER_INTERVIEW_FINDINGS.md`** — it's the corrected record of the
owner interview, including a mistake I made and fixed (there is only one
Tolliver; the other name was a musician the speakers joked about).

Facts that will save you time:

- **CareTime holds zero documents for all 50 people.** Compliance evidence lives
  only in email. The owner confirmed this: _"the background checks are not [in
  the system]. We got to put those into the system."_
- **CERTIFICATIONS folder: 77 items.** Likely the backfill source.
- **Referrals are wildly inconsistent** — some are structured DCSC documents,
  some are one-line "call this person" emails with no attachment.
- **Real surname collisions:** Harris (Rushane/Yvonne), Martinez (Louisa/Mark),
  Tisby (Kevan/Rejane). Never auto-resolve on surname alone.
- **Denied claims are NOT in CareTime.** Its "Billing Issues Report" only covers
  payer config and is empty. Denials live in an external system.
- **The real cause of denials is a code mismatch** between the client record and
  the caregiver record — ICD-10 / service code, e.g. `T1019`. On clock-in
  CareTime auto-applies the caregiver's code; if it doesn't match the
  authorization the claim is rejected. **This is detectable before billing** — a
  pre-submission mismatch check is likely worth more than post-denial triage.

Design constraints that matter:

1. **Store the source document, not just parsed fields.** A surveyor wants the
   CBI result PDF, not a row saying "passed". File it through the existing
   pipeline.
2. **Never mark anyone compliant automatically.** Populate a review queue.
3. **Fuzzy matching is the hard part**, not parsing.
4. Certifications are a one-time backfill; referrals are continuous. Same agent,
   two runtime shapes.

---

# Fork 2 — Job application

**Scope:** replace JotForm. `dtcjobapp` has a frontend and backend and deploys
nowhere yet.

**Why it's a separate repo/deploy:** it accepts submissions from the public.
That is a different security posture to an authenticated staff app, and mixing
them in one deployment is asking for trouble.

**The handoff it needs to produce:** application → reviewed → hired → **create a
`newHire` user in the DTC app**. From there the chain already exists: packet →
release training → courses → verify → caregiver. The job app only owns the top
of that chain.

Current flow it replaces: JotForm submission → email to Rashaune/owner with a
secure link → view/export → if hired, new-hire paperwork (including background
checks) → then training.

---

## One security issue worth fixing regardless

The course site authenticates with **anonymous Firebase auth plus a rotating
access code** (`RRC3` in `access-config.js`). Anyone with the URL and code
reaches the courses no matter what the DTC app says. The release gate is real
inside the app but **not enforced on the course site itself**. If the gate is
meant to be genuine, the course site needs to check the handoff token.

Separately: a GitHub personal access token is committed in plaintext in
`.git/config`. Worth revoking at github.com/settings/tokens.

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

## Built — the matcher and the review queue

`functions/` holds the ingestion pipeline; see `functions/README.md` for the
Graph app registration and deploy steps. 44 tests pass, `tsc` clean.

The queue is the shared core, not just the email agent's plumbing: the 77-item
certification backfill and the 126 GoFormz records go through the same
`enqueue()` and land in the same screen. Reviewed at
**Office Manager → Inbound**, which is office-manager-and-above only.

**The rosters are more dangerous than this document said.** The collisions
recorded above are all *within* the staff roster. The ones that actually decide
which filing cabinet a document lands in span the two rosters, and nobody had
written them down:

| Text | Could be | |
|---|---|---|
| `D Hardman` | Debra Hardman | **client** |
| | Dean Hardman | **staff** |
| `Carbajal` / `Carabajal` | Flora Carbajal | **client** |
| | Ernest Carabajal | **staff** |
| `Rodriguez` | Angelina / Nevaeh | client / staff |
| `Richardson` | William / Faith | client / staff |
| `Vuong` | Long / Vidia | client / staff |
| `Hunter` | Deonshay / Frances | two clients |
| `Coria` | Liborio Coria / Lovenus Ruiz-Coria | two staff |

So `matchName` returns a confidence, never an answer. A tie spanning the two
rosters is forced to `ambiguous` on a wider margin than a same-roster tie, and
only a full first-and-last-name match is ever pre-selected in the UI. Surname
plus an initial — 53 of the 126 GoFormz records — is suggested and never
defaulted.

Every resolution records whether the reviewer took the suggestion or overrode it
(`resolutionKind`). That's the only honest read on whether the matcher works,
and it's free to capture now and impossible to reconstruct later.

**It runs on the free tier.** This was Firebase Cloud Functions first, which
need the paid Blaze plan for what is one cron job and two form posts. It now
deploys as Netlify functions alongside the app — a 15-minute poll is ~2,900
invocations a month against a 125,000 allowance. `functions/` is a plain
library with no hosting SDK in it; `netlify/functions/` holds the three entry
points, and a GitHub Actions cron would be a drop-in replacement.

The cost is execution time: free-tier functions get a short window, so the poll
works to a wall-clock budget and stops politely rather than being killed
mid-attachment. The watermark only advances past messages that were fully
handled, so an interrupted run costs minutes, not a referral.

**Blocked on you:** the Netlify environment variables (a Firebase
service-account key and the Graph credential — see `functions/README.md`), and
`Mail.Read` scoped to the one mailbox with an application access policy.
Unscoped, that credential reads every mailbox in the tenant.

**Worth checking:** Firebase Storage itself may require Blaze on projects
created after ~Oct 2024. If `filed/` PDFs already work, this is moot.

**Not started:** the Outlook poll is written but has never run against a real
mailbox; the certification backfill and GoFormz import still need writing on top
of `enqueue()`; the pre-billing code-mismatch check needs CareTime service codes,
which are **not** in `migration/*.json` — the roster extract doesn't carry them.

Facts that will save you time:

- **CareTime holds zero documents for all 50 people.** Compliance evidence lives
  only in email. The owner confirmed this: _"the background checks are not [in
  the system]. We got to put those into the system."_
- **CERTIFICATIONS folder: 77 items.** Likely the backfill source.
- **Referrals are wildly inconsistent** — some are structured DCSC documents,
  some are one-line "call this person" emails with no attachment.
- **Real surname collisions:** Harris (Rushane/Yvonne), Martinez (Louisa/Mark),
  Tisby (Kevan/Rejane). Never auto-resolve on surname alone. **Tisby is the worst
  one:** Rejane Tisby is the *owner of the agency* and Kevan Tisby is the assistant
  administrator. Both are `admin`, so a wrong match here misfiles against the owner's
  own record. She is also service coordinator on 11 of the 30 clients — see
  `OWNER_INTERVIEW_FINDINGS.md`.
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

## Training gate — done, with one path deliberately left open

The gate is now enforced at four independent points rather than only in the UI:

1. `createCourseHandoff` won't mint a token for a `newHire` without
   `coursesUnlockedAt` — this is the credential the course site trusts.
2. Firestore rules block creating the handoff document at all in that case, so
   calling Firestore directly doesn't help. The client check is convenience;
   this is the boundary.
3. The course site verifies `role` and `coursesUnlockedAt` off the handoff
   rather than trusting whoever opened the link.
4. Handoffs expire after 10 minutes — one hop from app to course site, not a
   durable key.

**Still open on purpose:** the name + DOB + shared access code path on the
course site. A code can be passed to someone whose training hasn't been
released, and nothing on that site can tell the difference — so this is the
remaining hole.

It stays open because existing caregivers use it for annual refreshers today.
`DTC_ACCESS.requireAppSignIn` in `dtccourses/access-config.js` is the switch:
set it to `true` and the code form disappears, leaving app handoff as the only
way in. **Precondition: every caregiver who takes courses needs an app account
first**, or they're locked out of their own annual training. That's the
long-term intent, not a today change.

Note `dtccourses` is a separate repo with its own Netlify deploy.

## Also worth doing

A GitHub personal access token is committed in plaintext in `.git/config` in
both repos. Worth revoking at github.com/settings/tokens.

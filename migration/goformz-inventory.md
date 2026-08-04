# GoFormz completed forms — inventory and import plan

_Read from app.goformz.com on 2026-08-04. 126 records across 6 pages._

## What's there

| Status | Count |
|---|---|
| Completed | 109 |
| Draft | 17 |

| Form type | Count |
|---|---|
| Supervisory Visit | 52 |
| New Hire packet | 18 |
| Client Care Plan | 16 |
| Caregiver Activity Report | 14 |
| Client Admission Packet | 10 |
| Workplace Violence | 7 |
| Emergency Preparedness (EPP) | 7 |
| Medication List | 1 |
| Unclassified | 1 |

Supervisory visits dominate, which matches the owner's account — Rashan does
them every 90 days for every client, and they're the highest-volume recurring
obligation in the agency.

## Name matching against the migrated rosters

Form titles embed the person's name, but in no consistent format. All of these
appear: `Hardman, Debra Care Plan` · `Coffey S Client Care Plan 072426` ·
`T Phillips_Client Care Plan` · `Robinson DA_...` · `_Belem Diaz 032526 ...`

Matching 126 titles against the 30 clients and 35 staff:

| Confidence | Count | Meaning |
|---|---|---|
| Confident | 41 | full first + last name present |
| Weak | 53 | surname plus an initial only |
| Unmatched | 32 | no roster match at all |

**Nothing should be auto-filed on this basis.** A weak match is a surname and
one letter — `T Edmundson` vs client `Terry Edmondson` is a spelling variant,
and `Harris` alone is ambiguous between Rushane and Yvonne.

## Why 32 don't match — these are real findings, not just noise

**Former staff and clients.** `T Everett`, `S Jackson`, `Belem Diaz`,
`Jann Green` don't appear on either active roster. CareTime lists 70 caregivers
of which only 35 are active, so these are almost certainly people who have since
left. Their completed paperwork still has to be retained.

**Spelling differences between GoFormz and CareTime.** `Edmundson` vs
`Edmondson`. `Roderiguez` vs `Rodriguez`. `Sisineros` vs `Sisneros`. GoFormz was
typed by hand; CareTime is the system of record.

**No name in the title at all.** e.g. a bare `Workplace Violence Policy`. Who
signed it can only be recovered by opening the form.

## Recommended import path

1. **Don't bulk auto-file.** Import as a review queue: each record carries its
   proposed match and confidence, and a human confirms.
2. **Confirm the 41 confident matches first** — quickest to clear, and it
   validates the matcher before anything ambiguous is touched.
3. **Weak matches get a picker**, defaulting to the proposed person.
4. **Unmatched go to a bucket** for manual assignment, with "former staff" and
   "former client" as valid destinations so their records aren't lost.
5. **Drafts (17) are not compliance records** — they were never completed. Import
   for reference only, clearly marked, or skip.

## Blocked on

The forms themselves still need exporting from GoFormz (PDF per record), and
writing them into Firebase Storage requires credentials this environment does
not have. The inventory and matching above is the part that could be done
without them.

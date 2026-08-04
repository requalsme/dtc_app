# Owner interview — findings from the raw transcript

_Source: "New Recording 7.m4a" (owner + Raina). Taken from the verbatim NotebookLM
source transcript, not its generated summaries — several of the decisions below
never appeared in the summaries._

## Decisions the owner actually made on the call

**Supervisory visits file under the CLIENT, not the caregiver.** They debated this
live and reversed mid-conversation. The reasoning is the compliance test itself:
> "I decided to put them in the individual's file because it comes to see if
> you've done it every three months for that particular person."

Note the owner briefly said they'd change it, then: _"No, I while I was talking I
decided against it."_ So the client-file rule is deliberate, not an oversight.

**Staff have their own files too.** Confirmed explicitly — "they're like their own
files." So the app needs both client files and staff files, with the routing rule
above deciding which one a given form lands in.

**Paper stays as the last backup — for now.** IHSS records are in blue folders on
purpose: _"having paper as the last backup is always the best option"_ until
everything is in the system. Don't design as if paper is being eliminated on day one.

## The real role taxonomy (regulatory, not job titles)

Read off a Colorado licensing document during the call:

agency owner · governing body · HCA (home healthcare) manager · administrator ·
assistant administrator · office manager · marketing director · scheduling
supervisor · **support personnel** · HR/finance director · caregiver · personal
care provider · consumer

Current coverage: owner/administrator/HCA = the owner. Governing body = owner,
Raina, Rashan, Kevin. Scheduling + support personnel = Rashan. HR/finance = Raven.
Marketing = the owner. **Support personnel is the acknowledged gap** — and it's
vague by nature: _"basically it's just all additional duties."_ The owner's own
framing: _"Maybe if we can get AI to take that job as an agent."_

This is why "Support Personnel agent" can't be specced as one thing. It should be
decomposed into concrete triggers, not built as a catch-all.

## Claims: the actual root cause of denials

The chain the owner described:

1. DCSC authorization gives authorized hours (homemaker vs personal care), the
   authorization number, and the ICD-10 / service code.
2. That goes onto the **client** record in CareTime.
3. The **caregiver** record must carry the *same* service code — e.g. `T1019`
   (personal care).
4. On clock-in, CareTime auto-applies that service code to the shift.
5. The shift produces the claim.

> "Their personal care code has to match the insurance code... All of that just
> has to match. That's all."

So denials are largely a **code-mismatch problem between the client and caregiver
records**, which means they're detectable *before* billing, not just after denial.
A pre-submission mismatch check is likely higher value than a post-denial agent.

## Concrete automatable rules stated on the call

- **No caregiver may exceed 12 hours in a day.** The owner personally re-checks
  this weekly.
- **Every change Raven makes to the hours sheet must be reported by name** so the
  owner can verify it. This is a manual audit trail that the app could produce
  automatically.
- Supervisory visits: **every 3 months per client**.
- Care plans: **yearly per client**.

## Compliance risk the owner disclosed

On the yearly care plans, which are supposed to involve a home visit:

> "I personally haven't been very good at that. I'm at least going to start
> calling them but I just been refilling them out."

Worth handling with care. The app can help (scheduling, reminders, evidencing
visits) but this is a real gap the owner is aware of, not a system defect.

## IHSS — a form that does not exist yet

Health maintenance content is *already inside* the care plan. But for IHSS the
owner wants a **separate supervisory check sheet that carries health maintenance
items**, because the supervisor physically goes out and checks them off (example
given: ostomy care). This is a **new form to build**, not one of the 19 existing
PDFs.

Future nurse role would own: new admissions, yearly care plans, and these IHSS
health-maintenance supervisory checks.

## Referral / authorization flow (verbatim shape)

1. Case manager emails a referral.
2. They send an **SOA (start of care)**. The owner signs and returns it.
3. They then send the **DCSC** — the authorization: hours by type, auth number,
   ICD-10/service code.
4. No reply needed at that point; the DCSC contents get keyed into CareTime.

The pain is step 2: _"they don't all send it over the same."_ Some DocuSign, some
faxed copies the owner has to re-sign through Adobe. _"It's a lot of..."_

## ~~Name-collision warning~~ — CORRECTED, not a real issue

An earlier version of this document claimed there were two similarly-named
caregivers, "Devon Tolliver" and "Don Toiver", and flagged it as a name-matching
risk. **That was a misreading of the transcript.**

There is only one caregiver: **Davon Tolliver**. The other name in that part of
the conversation is the musician **Don Toliver** — the speakers went off on a
tangent about the coincidental similarity. It is not agency data.

CareTime confirms this: the active roster contains exactly one Tolliver.

Fuzzy name-matching still needs human confirmation in the email agent as a
general principle (two staff share the surname Branch, and two share Harris), but
this specific pair was never a real collision.

## Misc

- Raven's hours spreadsheet was referred to as a "CDM caregiver sheet."
- The owner already corrects assignment errors on that sheet by hand and had just
  made one (wrong person assigned to a slot) during the call.
- Background check results are explicitly **not** in the email in the owner's
  understanding: _"the background checks are not. We got to put those into the
  system."_ — consistent with CareTime showing zero documents for everyone.

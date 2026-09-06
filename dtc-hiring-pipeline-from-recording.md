# Hiring & background-check pipeline — from Recording 9

Source: `New Recording 9.m4a` (45:15), automated transcript. The business content is
roughly the first 20 minutes; the remainder is a personal family conversation and is not
summarised here.

Speaker is the agency owner (Rejane) explaining the real hiring process to Raina.

---

## The four background checks

Every hire goes through four, all currently keyed in **by hand, one system at a time**,
by Rushane in the office:

| Check | What it is | Needs SSN? | Turnaround |
|---|---|---|---|
| **CBI** | Colorado Bureau of Investigation — criminal record | Yes | Immediate |
| **CAPS** | Colorado Adult Protective Services | Yes | **3–5 days** |
| **DORA** | Colorado Dept. of Regulatory Agencies — license verification | No | Immediate |
| **E-Verify** | Federal work authorisation | Yes | Immediate |

**DORA needs only** first name, last name, and address or date of birth.

### Two ordering rules that matter

1. **CAPS goes in first** because it is the only slow one (3–5 days). Everything else
   returns immediately, so CAPS is the critical path on time-to-hire.
2. **CBI is the gate.** The agency *pays* for both CBI and CAPS. CBI is run first, and if
   the applicant fails it, CAPS is never ordered — that's a direct cost saving. So the
   real sequence is: CBI → (if pass) CAPS immediately, then DORA + E-Verify.

These two rules are in tension (CAPS is slowest but CBI must clear first), and the
current manual process is where that tension is being absorbed.

---

## What still forces an office visit

**CAPS and the I-9 are done on paper, in person.** The applicant physically comes into the
office, signs, and Rushane then keys the information into the state systems.

The owner explicitly wants e-signature for these ("if you had hypothetically Adobe Sign
for all these things that would help you not have people come in"). This is the single
biggest process win available and it is squarely what the forms system is for.

Note the I-9 nuance: the applicant genuinely has to complete the I-9 itself, but the
*information from it* is what gets re-entered to run E-Verify. So the form and the data
extraction are two separate needs.

---

## Licences

Colorado requires the agency to verify **every** Colorado licence a person holds — nursing,
CNA, EMT — *even when they are not being hired in that capacity*.

Also important: a licence can carry a **board action without any criminal charge**. Someone
can be reported to the State Board of Nursing, get a licence review, and have nothing on a
criminal background check. So a clean CBI does not mean a clean licence.

---

## How the owner actually decides

The state gives **no explicit list**. Its only guidance is, roughly, "make sure it's not
harmful to who you're providing services to." The decision — and the liability at survey
time — sits entirely with the employer.

The owner's own standard:

- **Look back 7–10 years.**
- **Effectively automatic no:** child abuse, domestic violence, forgery, homicide, identity
  theft, kidnapping. Rationale is specific to the work — staff are alone in someone's home
  with a vulnerable person and their property.
- **Look closer:** assault. The charge level (assault 1/2/3, assault vs. battery) matters,
  and so does context — one applicant passed because the assault and a domestic-violence
  charge were the same incident and she was a party to it.
- **Generally let go:** dismissed charges (not enough evidence, no charge filed).
- **Judgment case:** a 30-year-old child-abuse charge turned out to be a DUI with a child in
  the car. The owner confirmed that was possible with a lawyer, asked the applicant for a
  written explanation, and hired her.
- Youth offences (pre-18) generally do not appear.

A state surveyor can review these records after the fact, so **the reasoning behind a
borderline hire needs to be written down**, not just the decision.

---

## Why the SSN is on the application

Asked up front, before hiring, because the application itself carries the background-check
consent — and the checks can't start without it. The owner acknowledged this is unusual
(most employers collect SSN after an offer).

**This settles the open question in the app:** SSN encryption at rest is not optional. The
owner's words: *"that means that needs an encryption or something"* → *"that's absolutely
needed, because you have to have a social security number to do the Colorado Bureau of
Investigation."* It is needed for CBI, CAPS, and E-Verify.

---

## Recruiting

- **Word of mouth is their best channel** and is currently untracked.
- The owner wants **"How did you hear about us?"** added to the job application. Agreed on
  the recording — this is a concrete, small change.
- Colorado Department of Labor offers a **free job-posting site** for caregivers. Instructions
  received; not yet posted.

---

## What this implies for the app

Not yet built — captured here so the jobapp migration doesn't get designed without it.

1. **SSN at rest must be encrypted.** Confirmed necessary, not speculative. Never a plain
   column.
2. **A background-check tracker per applicant** — four checks, each with ordered/returned
   dates, result, and who ran it. CAPS flagged as the long pole; CBI as the gate that
   authorises spending on CAPS.
3. **A decision record** for borderline hires — what was found, what was asked, what the
   applicant explained, why the hire was made. This is the artefact a surveyor asks for and
   it currently exists only in the owner's memory.
4. **A licence register** — type, number, state, expiry, and a board-action check that is
   separate from the criminal check.
5. **E-signature for CAPS and the I-9**, to remove the in-person visit. Highest-value
   process change mentioned.
6. **"How did you hear about us?"** on the application.

# DTC App ↔ Course Site Integration Plan

_For review before any edits to the live course folder (which auto-deploys via Netlify)._

## The two systems today

- **DTC app** (`dtc app`, Firebase project `dtcapp-24504`): real accounts via Firebase Auth (email), roles, forms, records. Deployed to Firebase Hosting / Netlify.
- **Course site** (`dtccourses`, → courses.daretocarehomecare.com): a static React site. Learners sign in with **name + date of birth + a rotating access code** — there are **no accounts and no database**. Progress lives only in the browser's `localStorage`, and certificates are generated in-browser and downloaded as PDFs. Nothing is saved centrally, so today there is no way for the app to know who completed what.

That last point is the whole challenge: to make certificates "show up like completed forms," the course site has to record completions somewhere the app can read, and we need a way to tie a completion to a specific DTC user.

---

## Decision 1 (I need your call): how certificates get back into the app

| Option | How it works | Course-site change | Match quality |
|---|---|---|---|
| **A. Email tag + Firebase write (recommended)** | Add one "Work email" field to the course sign-in. On passing a module, the site writes a small completion/certificate record to the same Firebase project, keyed by that email. The DTC app shows it under that user automatically. | Small, contained | Exact (by email) |
| **B. Name/DOB write + admin match** | Site writes completions keyed by name + DOB. In the app, an admin links each incoming completion to the right user. | Small | Fuzzy; needs admin step |
| **C. Manual upload** | No course-site backend. The learner (or admin) uploads the downloaded certificate PDF into the app as a record. | None | Manual |
| **D. Full single sign-on** | Course site replaces access codes with Firebase login, same as the app. | Large rewrite | Exact |

My recommendation is **A**: it's genuinely seamless, keeps the course site on its own subdomain, and is a minimal, low-risk edit. It does require enabling a narrow Firebase write from the course domain (I'll write tight security rules so it can only create certificate records, nothing else).

---

## Decision 2 (confirm or adjust): which forms go to which portal

Every form/packet from the course repo, mapped to a DTC portal. Forms can appear in more than one portal.

| Form (source PDF) | Type | Proposed portal(s) |
|---|---|---|
| Workplace Violence Policy Acknowledgement | Read + sign | New Hire, Caregiver |
| Review of Client Care Plan | Read + sign | Caregiver, Office Manager |
| Supervisory Visit Form | Fill-in (about caregiver/client) | Office Manager, Admin |
| Home Health Care Activity Report | Daily fill-in log | Caregiver |
| Emergency Preparedness Plan (EPP) Acknowledgement | Read + sign | New Hire, Caregiver (annual) |
| SOP Manual (7 pp.) | Reference / acknowledge read | All staff |
| **New-Hire Packet (22 pp.)** — breaks into the pieces below | | **New Hire** |
| • Employment Application / Caregiver Interview Questions | Fill-in | New Hire |
| • Homemaker & Personal Care Worker Job Descriptions | Read + acknowledge | New Hire |
| • Caregiver Availability & Emergency Contact Info | Fill-in | New Hire |
| • Caregiver Rules of the Road | Read + acknowledge | New Hire |
| • Acknowledgment of Employee Handbook | Sign | New Hire |
| • Receipt of Policies and Procedures | Sign | New Hire |
| • Personal vs Nurse-Aide vs Health Care in the Home | Read + acknowledge | New Hire |
| • Direct Care Allowed / Non-Allowed Tasks | Read + acknowledge | New Hire |
| • Employee Automobile Use Policy | Fill-in (Yes/No) + sign | New Hire |
| • Client Confidentiality / HIPAA Staff Policy | Read + sign | New Hire, Caregiver |
| • Notice of Privacy Practices (HIPAA) + Acknowledgement | Read + sign | New Hire |

Client Portal forms already stubbed in the app (Service Agreement, Care Preferences, Emergency Contacts, HIPAA Authorization, Satisfaction Survey) will be built as real client-subject forms too.

---

## Decision 3 (word-for-word + full-text PDFs)

You asked that forms stay word-for-word accurate and that finished PDFs show the **full text**, not just inputs and signatures. The app's current form model only stores field labels + values, so:

- I'll transcribe each policy/acknowledgement's full body text verbatim into the form definition as read-only "policy text" blocks.
- I'll rebuild the PDF generation (Wave B) so the exported PDF renders the complete document — heading, full body text, the fields the user filled, and the signature — as a proper multi-section document.

This is the most labor-intensive part (a lot of exact transcription), so I'll do it form-by-form and let you spot-check.

---

## What edits go where

- **DTC app repo** — the bulk of the work: bug fixes (already started), new form schemas, PDF rebuild, certificate display, security rules. Not production-connected the way the course folder is, so lower risk.
- **Course site repo (`dtccourses`)** — kept to the absolute minimum: for Option A, add one email field + a small Firebase write on module pass, and (per your instruction) make the app "Training" button link out to courses.daretocarehomecare.com. I will show you each course-site diff before it deploys.

---

## What you'll need to do (I'll walk you through each)

1. **Pick Decision 1** (A/B/C/D) and confirm Decisions 2 & 3.
2. In the **Firebase console** (guided, click-by-click): confirm Email/Password auth is on; if we do Option A, I'll give you exact security rules to paste and publish.
3. Confirm you want me to proceed form-by-form on the word-for-word transcription (this is the long pole).

## Sequencing I propose

1. **Finish the DTC app bug fixes** (Wave A — already in progress) so the app is stable to build on.
2. Rebuild PDF generation to show full text (Wave B).
3. Build the real forms from the packets, word-for-word, into the mapped portals (Wave C+).
4. Wire certificate flow per your Decision 1.
5. Lock down security rules; build/verify; give you the console steps.

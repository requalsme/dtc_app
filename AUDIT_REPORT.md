# Dare to Care Platform — Audit Report

_Date: July 1, 2026 · Reviewed by: Claude (Cowork) · Method: full source-code audit_

## What this app actually is

A React + Vite + TypeScript single-page app on **Firebase** (project `dtcapp-24504`) — Firestore for data, Firebase Auth for login, Firebase Storage for training videos. There is **no backend server**; everything runs in the browser and talks directly to Firebase.

Five roles exist: **Admin, Office Manager, Caregiver, New Hire, Client**. The admin can "preview" the other roles from the sidebar, which is genuinely useful for testing with one account.

Overall verdict: the app **looks** finished and polished, but underneath there are several hard crashes, a broken core workflow, multiple features that are visual-only, and no security enforcement. It is **not launch-ready** yet. The good news: most of it is fixable in code, and the bones (form engine, role routing, client management) are solid.

---

## 1. The course integration does NOT exist (your #1 question)

You asked whether the integration with **courses.daretocarehomecare.com** is smooth and seamless. It isn't there at all.

- There is **zero reference** to `courses.daretocarehomecare.com` anywhere in the code.
- The "Training Courses" page pulls a `courses` collection from Firestore and streams `.mp4` files from Firebase Storage. It is a self-contained video player, not a link or single-sign-on into your existing course site.
- The New Hire training modules load videos from `courses/<step>.mp4` in Firebase Storage — again, nothing to do with the external site.

**This is a decision, not just a bug.** You need to tell me how these two should relate (see "What I need from you" at the end).

---

## 2. Hard crashes (white screen) — Priority 0

These break entire pages for real users right now:

1. **Admin → Users page crashes on open.** The code uses `revealedPassword`, `setRevealedPassword`, and `revealPassword()` which are never defined. Opening the Users tab throws a ReferenceError.
2. **"Create account" button is permanently disabled.** Its enable-check looks at `form.username`, but the form field is `email`. The button can never be clicked, so no team members can be created through the UI.
3. **Template Builder crashes after every import.** Imported templates store the schema *nested* under a `schema` key, but the Builder reads `template.sections` (top level), which is undefined → crash. So the Import → Edit → Publish flow dies at the edit step.
4. **Caregiver → Records tab crashes** when any record exists, because it calls `submission.submittedAt.slice(...)` and `submittedAt` is never saved on submissions (see #3 below).

---

## 3. Broken core workflow: submit → review — Priority 1

The caregiver-submits-a-form → office-manager-reviews-it loop is broken:

- When a caregiver submits, the record is saved **without** `status`, `submittedAt`, `caregiverId`, or `caregiverName`.
- The Office Manager screen only shows records where `status === "submitted"`, so **submitted forms never appear for review**.
- The caregiver's own list filters by `caregiverId`, so **caregivers won't see records they just filed**.
- Status-string mismatch: when an office manager requests a correction, the code saves `"correction_needed"`, but every other screen looks for `"needsCorrection"`. So **corrections never surface** to the caregiver.
- "Reviewed by / reviewed at" is displayed but never actually set.

Net effect: the review cycle silently fails end-to-end.

---

## 4. Fake / hallucinated features (look real, do nothing)

- **Audit log** — The app repeatedly claims "Audit event recorded" and shows an Audit Log page with CSV export. But **nothing ever writes an audit event**; the collection is only ever read. The log will always be empty, and "Export CSV" exports an empty file.
- **"Signed PDF generated server-side"** — Shown on the review screen, the submit confirmation, and the footer ("Secure PDFs"). There is **no server** and the PDF library (`pdf-lib`) is installed but never used. No PDF is ever created or stored. "Open stored PDF" only appears if a `pdfUrl` exists, which never happens.
- **Offline mode** — A banner says "forms will be queued and submitted when you reconnect." Nothing ever adds anything to the queue, so offline submissions simply fail. The "Pending upload" section is permanently empty.
- **"Upload PDF"** — The nav implies you can upload a PDF and it gets parsed ("Reading source layout… Detecting fields…"). That animation is fake; it just imports one of **5 hardcoded** built-in forms. There is no file picker and no PDF parsing.
- **Client Portal forms** — The 5 cards (Service Agreement, Care Preferences, Emergency Contacts, HIPAA, Satisfaction Survey) are buttons with **no click handler**. Clicking does nothing.
- **New Hire paperwork** — The "Fill out" paperwork step just marks itself done locally without opening any form, and non-video steps' progress isn't saved (lost on refresh).
- **Dead nav links** — New Hire "Training" and "Paperwork", and Client "Documents", all render the exact same portal page. They don't lead anywhere distinct.

---

## 5. Security — Priority 0 for clinical data

- **Firestore rules allow any logged-in user to read and write everything.** The rule is effectively `allow read, write: if request.auth != null;`. That means any caregiver (or any authenticated account) can read every client's PHI, every other user's record, and can modify or delete anything. The code itself even comments: _"Need proper user role tracking to restrict this, fetching all for now."_ For a home-care app holding health information, this needs to be locked down before launch.
- Phone-number login and "Link phone number" require Firebase **Phone Authentication** to be enabled (and usually billing). If it isn't enabled, those flows will error.
- The Firebase web API key is in the source. That's normal and safe for Firebase web apps **as long as** the Firestore/Storage security rules are correct — which currently they are not.

---

## What works well

- Role-based routing and the admin "preview as role" feature.
- The form-filling wizard: sections, validation, live scoring, signature capture, review step.
- Client create/edit/assign, and the first-time admin setup wizard.
- Password reset via Firebase email, and the forced first-login password change.

---

## What I need from you (plain-English)

1. **Course site — pick a direction:** Should the app (a) send users over to `courses.daretocarehomecare.com` with single sign-on, (b) embed that site, or (c) drop the external site and keep training as Firebase videos? To do (a) or (b) I need to know what platform that site runs on (e.g. Teachable, Thinkific, WordPress/LearnDash, Moodle, something custom). You can usually tell me from your admin login there.
2. **Firebase console access items** (I can guide you click-by-click): enabling Phone auth if you want it, uploading training videos, and publishing tightened security rules once I write them.
3. **How much you want me to fix now** — see the question I'm asking alongside this report.

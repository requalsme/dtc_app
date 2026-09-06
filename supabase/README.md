# Supabase setup and migration runbook

Everything in this folder and in `migration/` exists to move this app off
Firebase and onto Supabase, once. Run the steps in order.

The two scripts are safe in different ways and it matters which is which:
the export **only reads** Firebase, and the import **only writes** Supabase.
Nothing in this process deletes anything from Firebase — turning the old
project off is a separate, deliberate decision made after the new one is
verified.

---

## 1. Create the project

Supabase dashboard → New project. Choose a region close to Colorado
(`us-east-1` or `us-west-1`). Keep the database password somewhere safe; it is
not the same as the API keys and is not used by this app.

Then collect four values from **Project settings → API**:

| Value | Goes where |
|---|---|
| Project URL | `VITE_SUPABASE_URL` and `SUPABASE_URL` |
| `anon` / public key | `VITE_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` — **server only** |

The `service_role` key bypasses every Row Level Security policy in
`schema.sql`. It belongs in Netlify's function environment and nowhere else —
never with a `VITE_` prefix, never in the frontend, never in a commit.

## The short version

Steps 2, 4 and 5 below are automated. Once the project exists and `.env` is
filled in:

```bash
npm run migrate -- --dry-run   # says what it would do, touches nothing
npm run migrate                # schema, storage, export, import, verify
```

It is resumable — the import upserts on original ids, so a run that fails
halfway can just be run again. The rest of this file is what that command does
and why, plus the steps that genuinely need a person.

## 2. Create the schema

SQL editor → paste and run, in this order:

1. `schema.sql` — tables, Row Level Security policies, and the triggers that
   enforce the rules RLS cannot express.
2. `storage.sql` — the three buckets and their access policies.

Both are idempotent enough to re-run while iterating, but run them against a
fresh project the first time so a half-applied state cannot be mistaken for a
finished one.

## 3. Turn on the auth methods the app uses

**Authentication → Providers:**

- **Email** — on by default. Needed for the ordinary login.
- **Phone** — the login screen offers SMS sign-in, and the account menu offers
  attaching a phone number. Supabase does not send SMS itself; it needs an SMS
  provider (Twilio, MessageBird, Vonage) configured with your own account.
  **Until that is configured, phone login will fail.** Firebase included this
  without a separate provider, so this is a real change worth deciding on
  rather than discovering.
- **Anonymous sign-ins** — the course site reads certificates and course
  progress from an anonymous session. Without this, certificates silently stop
  arriving, which looks exactly like nobody finishing a course.

**Authentication → URL configuration:** set the site URL to the live Netlify
domain so password-reset links come back to the right place.

## 4. Export everything out of Firebase

Read-only. Run it before anything else touches Firebase.

```bash
FIREBASE_SERVICE_ACCOUNT="$(netlify env:get FIREBASE_SERVICE_ACCOUNT)" \
  node migration/export-firebase.mjs
```

Writes `migration/export/`: every collection as JSON, every Storage object's
actual bytes, and a manifest. **Keep this.** Once the Firebase project is gone
it is the only copy of the old state, and it is what you diff against if
anything looks wrong later.

## 5. Import into Supabase

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node migration/import-supabase.mjs
```

Idempotent — every write is an upsert keyed on the original id, so a failed run
can simply be repeated.

It writes `migration/export/id-map.json`, the old-Firebase-UID → new-UUID map.
Keep that with the export: it is what makes a migrated record traceable back to
its origin, and what any later reconciliation would need.

### Two things this step changes, unavoidably

**Everyone must reset their password.** Firebase hashes passwords with a
project-specific scrypt variant that is not portable to any other system. The
import creates each account without a usable password and flags
`must_change_password`. Send everyone a reset link before they next need to log
in — there is no version of this migration where that is avoidable.

**User ids change.** A Firebase UID is a 28-character string; `auth.users.id`
is a `uuid`. Accounts are re-keyed, the old value is kept in `users.legacy_uid`,
and every reference to a user elsewhere is rewritten through the id map.
Records keyed by their own Firestore id — clients, submissions, documents —
keep that id exactly, so references between *those* are untouched.

## 6. Point the app at it

Netlify → Site configuration → Environment variables. Set everything in
`.env.example`: the two `VITE_` values, the two server-side Supabase values, and
the existing Graph/mailbox variables, which the migration did not change.

Then remove `FIREBASE_SERVICE_ACCOUNT`, but not until step 7 passes — it is the
credential the export script needs if you have to run it again.

## 7. Verify before trusting it

```bash
curl -H "x-preflight-key: $PREFLIGHT_KEY" \
  https://<site>/.netlify/functions/preflight-ingestion
```

Checks the credentials, the database, the three storage buckets, and the
mailbox, and says which are wrong. It writes nothing, so it is safe against
production.

Then walk the app by hand, as each role: log in, file a submission, upload a
document, request and resolve a correction, review the inbound queue, open a
filed PDF, create a user, and open the training page. A green preflight means
the plumbing is connected; it does not mean the permissions are right.

---

## Verifying the policies actually hold

```bash
node supabase/verify-policies.mjs
```

Plants a probe row in each table with the service-role key, checks a
signed-out caller still sees nothing, attempts writes that must be refused,
then removes the probes. Safe against production.

The seeding step is the point. On an empty database "the anon caller got zero
rows" and "the table was empty anyway" look identical, so a suite without it
passes whether or not the policies exist at all.

Role-level distinctions - staff vs caregiver vs dev - need real accounts, and
are covered by the manual walkthrough in step 7.

## What is deliberately different from Firebase

**Storage access is genuinely role-checked now.** `storage.rules` carried a
documented limitation: Firebase Storage rules cannot read Firestore, so they
could not check a caller's role, and every read degraded to "any signed-in
user". The protection was that the records holding the download URLs were
role-gated — which is obscurity of the path, not permission. Supabase Storage
policies are ordinary Postgres RLS and can join against `public.users`, so
`storage.sql` does the role check that was previously impossible. A caregiver
can no longer read an arbitrary client's filed document by knowing its path.

**No permanent download URLs.** `getDownloadURL()` minted a bearer-token URL
that never expired and was then stored in the record, so anyone who ever saw
one kept access forever — including after being offboarded — and revoking it
meant rewriting every row. Records now store a path, and a short-lived signed
URL is minted per view, so access is re-decided against the policies every time.

**Account creation moved to the server.** It needs the service-role key and a
role check the caller cannot edit. Doing it in the browser meant the only thing
between a caregiver and a new admin account was which buttons the UI rendered.

## Still pointing at the old Firebase project

Neither of these is in this repo, and both break when the Firebase project is
switched off:

- **dtc-jobapp** (careers.daretocarehomecare.com) — writes applications
  straight into the old Firestore.
- **dtc-courses** (courses.daretocarehomecare.com) — reads and writes
  certificates, course progress and handoffs there, and reads training videos
  from the old Storage bucket.

They each need the same treatment against this same project. Until then, leave
the Firebase project running.

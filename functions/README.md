# Ingestion — Outlook to the review queue

Pulls documents out of the DTC Outlook mailbox, works out who each one is
probably about, and puts it in a queue for a person to file. It never files
anything itself and never marks anyone compliant.

Compliance evidence for the agency currently lives only in email — CareTime
holds zero documents for all 50 people on the roster. This is the pipe that
moves it somewhere a surveyor can be shown it.

## Where it runs, and why not Firebase

This directory is a **library**, not a deployment. Nothing in it imports a
hosting provider's SDK — it needs a Firestore handle, a Storage bucket and a
Graph credential, and runs anywhere that can supply those.

The deployed entry points are **Netlify functions** in `netlify/functions/`:

| Endpoint | Kind | What it does |
|---|---|---|
| `poll-outlook` | scheduled, `*/15 * * * *` | Pulls new attachments into the queue |
| `resolve-inbound` | POST | A reviewer files a document against a person |
| `dismiss-inbound` | POST | Not a compliance record |
| `preflight-ingestion` | GET | Read-only: is any of this actually configured? |

It was originally written as Firebase Cloud Functions, which require the paid
**Blaze** plan — for what is, in practice, one cron job and two form posts.
Netlify runs all three on the free tier: a 15-minute poll is about 2,900
invocations a month against a 125,000 allowance.

The tradeoff is execution time. Free-tier functions get a short window, so the
poll works to a **wall-clock budget** and stops politely rather than being
killed mid-attachment. The watermark in `metadata/ingestion` only advances past
messages that were fully handled, so an interrupted run costs a few minutes, not
a referral.

## The shape of it

```
Outlook ──poll──▶ classify ──▶ match against both rosters ──▶ inbound queue
                                                                   │
                                                        a human picks a person
                                                                   │
                                                                   ▼
                                            filed/{client|staff}/{id}/…  +  submissions
```

Two halves, deliberately split. The scheduled half only ever produces
suggestions, so it is allowed to be wrong. The filing half runs only when
someone clicks a name, and re-verifies their ID token and role before it writes.

| File | What it does |
|---|---|
| `src/matcher.mjs` | Ranks roster people against free-text names. The hard part. |
| `src/classify.mjs` | What kind of document is this, and which roster to lean towards |
| `src/roster.mjs` | Loads clients and staff into one list |
| `src/queue.mjs` | Stores the source document, writes the queue entry |
| `src/poll.mjs` | One budgeted pass over the mailbox |
| `src/resolve.mjs` | Filing and dismissal |
| `src/graph.mjs` | Minimal Microsoft Graph client |
| `src/firebase.mjs` | Admin init from a service-account key in an env var |
| `src/auth.mjs` | ID-token verification and the role check |

## Why the matcher refuses to decide

The rosters contain collisions that a naive matcher resolves confidently and
wrongly. The expensive ones span the two rosters, because they decide which
filing cabinet a document lands in:

| Text | Could be | |
|---|---|---|
| `D Hardman` | Debra Hardman | **client** |
| | Dean Hardman | **staff** |
| `Carbajal` / `Carabajal` | Flora Carbajal | **client** |
| | Ernest Carabajal | **staff** |
| `Rodriguez` | Angelina Rodriguez | **client** |
| | Nevaeh Rodriguez | **staff** |
| `Richardson`, `Vuong` | one of each | |
| `Harris`, `Martinez`, `Tisby` | two staff each | |
| `Hunter` | two clients | |

So `matchName` returns a confidence, not an answer:

- **confident** — full first and last name. Pre-selected in the queue, still needs a click.
- **weak** — a surname and an initial, or a spelling variant. Suggested, never pre-selected.
- **ambiguous** — two people fit. Nothing pre-selected, and the note says why.
- **unmatched** — nobody fits. Often a former client or a former member of staff, whose records still have to be retained.

A tie that spans the client and staff rosters is forced to `ambiguous` even when
it scores well, and uses a wider margin than a same-roster tie.

Run the tests before changing any of the scoring constants — they encode real
cases from the CareTime rosters and the GoFormz title corpus:

```bash
cd functions && npm test      # 54 tests
```

## Seeing what it would do, before it can do anything

```bash
cd functions && npm run dryrun
```

Runs the entire pipeline — classify, match, dedupe, watermark, time budget —
against the real rosters from `migration/*.json` and a stand-in mailbox, and
prints the queue it would produce. No Firebase, no Graph, no credentials, no
network, nothing written.

This exists because the pipeline's failure mode is silence. A poll that skips a
message still returns 200 and still logs "0 queued", which is exactly what a
genuinely empty mailbox looks like; the difference surfaces during a survey.
`test/fakes.mjs` holds the stand-ins, and `test/poll.test.mjs` pins the
behaviour this README promises — the watermark, the dedupe key, the attachment
filter, and what happens when Graph fails halfway through a run.

## Surveying the real mailbox

```bash
cd functions && npm run survey        # needs only the Graph credential
```

Read-only, writes nothing, downloads no attachment contents. Threads Inbox
against Sent Items and reports what arrives, in what formats, and how often
something goes back out attached to the same conversation.

Written to answer one question with data rather than memory: *does the agency
receive documents that have to be signed and returned?* Nothing in this
pipeline signs anything or sends anything — Graph is granted `Mail.Read` only —
so whether that gap matters is a question about the mailbox, not the code.

## Setting it up

**Working through it for the first time? Use [GOING-LIVE.md](./GOING-LIVE.md)** —
same steps, in order, each one ending in something you can check. What follows
here is the reference version.

### 1. Firebase service account

The functions talk to Firestore and Storage as an admin, so they need a key
rather than ambient credentials.

1. Firebase console → Project settings → Service accounts → **Generate new private key**
2. Do not commit it. Paste the JSON into the Netlify variable below — base64 is
   also accepted, since some dashboards mangle multi-line values.

### 2. Microsoft Graph

The poll runs with nobody signed in, so it uses app-only (client credentials)
auth rather than delegated.

1. **Register an app** — Entra admin centre → App registrations → New registration.
   Single tenant. No redirect URI needed.
2. **Grant the permission** — API permissions → Microsoft Graph → *Application*
   permissions → `Mail.Read` → Grant admin consent.
3. **Scope it down.** `Mail.Read` as an application permission grants access to
   **every mailbox in the tenant** by default. Restrict it to the one mailbox
   with an application access policy, or that secret is a key to the whole
   organisation's email:

   ```powershell
   New-ApplicationAccessPolicy -AppId <client-id> `
     -PolicyScopeGroupId intake@daretocarehomecare.com `
     -AccessRight RestrictAccess `
     -Description "DTC ingestion - intake mailbox only"
   ```

4. **Create a client secret** and note the value — it is shown once.

### 3. Netlify environment variables

Site settings → Environment variables. All five are required; the poll refuses
to run with an empty mailbox rather than looking healthy and ingesting nothing.

| Variable | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | The service-account JSON (or base64 of it) |
| `FIREBASE_STORAGE_BUCKET` | `dtcapp-24504.firebasestorage.app` |
| `GRAPH_TENANT_ID` | Directory (tenant) ID |
| `GRAPH_CLIENT_ID` | Application (client) ID |
| `GRAPH_CLIENT_SECRET` | The client secret value |
| `DTC_MAILBOX` | e.g. `intake@daretocarehomecare.com` |

Mark them **secret** where Netlify offers it, and scope them to production.

### 4. Rules and indexes

These still deploy through Firebase, and still need your login:

```bash
firebase login
firebase deploy --only firestore:rules,firestore:indexes,storage
```

`DEPLOY-RULES.bat` does the same thing. Storage is on console defaults until
this runs — do it before real PHI is filed.

## One thing to check

**Firebase Storage may itself require Blaze.** Projects created after roughly
October 2024 need the paid plan to use Cloud Storage at all. If `filed/` PDFs
already work today, the project is fine as-is. If Storage turns out to need
Blaze, moving the functions to Netlify hasn't avoided the plan — though it has
made the ingestion portable, and Blaze at this volume stays inside the free
allowance anyway.

## If Netlify's limits ever bite

The library has no Netlify in it. A GitHub Actions cron is the obvious next
stop — free for private repos up to 2,000 minutes a month, with no execution-time
cap worth worrying about — and would need only a new entry point calling
`pollMailbox`.

## What is deliberately not automatic

- **Nobody is marked compliant by this pipeline.** It files documents; a person
  reads them.
- **The source document is kept, not just parsed fields.** A surveyor wants the
  CBI result PDF, not a row saying "passed".
- **Filing copies rather than moves.** The original stays under `inbound/`, so a
  mis-filing can be traced back to what the reviewer was looking at.
- **Dismissed entries are not deleted.** "We looked at this and decided it was
  nothing" is a record worth keeping.
- **Every resolution records whether the reviewer took the suggestion or
  overrode it** (`resolutionKind`). That is the only honest measure of whether
  the matcher is any good, and it costs nothing now and everything later.

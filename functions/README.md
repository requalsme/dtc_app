# Ingestion — Outlook to the review queue

Pulls documents out of the DTC Outlook mailbox, works out who each one is
probably about, and puts it in a queue for a person to file. It never files
anything itself and never marks anyone compliant.

Compliance evidence for the agency currently lives only in email — CareTime
holds zero documents for all 50 people on the roster. This is the pipe that
moves it somewhere a surveyor can be shown it.

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
someone clicks a name, and re-checks their role server-side before it writes.

| File | What it does |
|---|---|
| `src/matcher.mjs` | Ranks roster people against free-text names. The hard part. |
| `src/classify.mjs` | What kind of document is this, and which roster to lean towards |
| `src/roster.mjs` | Loads clients and staff into one list |
| `src/queue.mjs` | Stores the source document, writes the queue entry |
| `src/graph.mjs` | Minimal Microsoft Graph client |
| `index.mjs` | The scheduled poll and the two callables |

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
node --test functions/test/
```

## Setting up Microsoft Graph

The poll runs with nobody signed in, so it uses app-only (client credentials)
auth rather than delegated.

1. **Register an app** — Entra admin centre → App registrations → New registration.
   Single tenant. No redirect URI needed.
2. **Grant the permission** — API permissions → Microsoft Graph → *Application*
   permissions → `Mail.Read` → Grant admin consent.
3. **Scope it down.** `Mail.Read` as an application permission grants access to
   **every mailbox in the tenant** by default. Restrict it to the one mailbox
   with an application access policy, or the credential in Secret Manager is a
   key to the whole organisation's email:

   ```powershell
   New-ApplicationAccessPolicy -AppId <client-id> `
     -PolicyScopeGroupId intake@daretocarehomecare.com `
     -AccessRight RestrictAccess `
     -Description "DTC ingestion - intake mailbox only"
   ```

4. **Create a client secret** and note the value — it is shown once.

## Deploying

Cloud Functions need the **Blaze** (pay-as-you-go) plan. A 30-minute poll of one
mailbox sits inside the free allowance, but the project has to be on Blaze for
functions to deploy at all.

```bash
cd C:\dev\dtc-app
firebase login

# Secrets — these are not stored in the repo
firebase functions:secrets:set GRAPH_TENANT_ID
firebase functions:secrets:set GRAPH_CLIENT_ID
firebase functions:secrets:set GRAPH_CLIENT_SECRET

cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules,firestore:indexes,storage
```

Set the mailbox when prompted on first deploy, or in advance:

```bash
firebase functions:config:unset   # not used; DTC_MAILBOX is a params.defineString
```

`DTC_MAILBOX` is a deploy-time parameter — `firebase deploy` will ask for it and
remember the answer in `.env.dtcapp-24504`. Set it to the mailbox you scoped the
access policy to. If it is left empty the poll logs an error and does nothing,
rather than looking healthy while ingesting nothing.

## First run

The first poll looks back 30 days, not all time — enough to prove the pipeline
works without burying the queue in a year of history. The watermark then lives
in `metadata/ingestion` and only advances past messages that were fully
processed, so a run that fails halfway resumes rather than skipping.

The 77-item CERTIFICATIONS folder is a separate, deliberate backfill. It goes
through the same `enqueue()` and lands in the same queue.

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

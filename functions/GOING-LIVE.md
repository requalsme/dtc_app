# Going live — pointing the ingestion at the real mailbox

This is the one thing standing between a pipeline that passes 54 tests and a
pipeline that has ever seen a real document. Work through it in order. Each step
ends with something you can check, so you never have to wonder whether the
previous one worked.

Set aside about 45 minutes. Two of the steps need someone with admin rights in
Microsoft 365; if that isn't you, step 2 is the one to forward.

---

## Before you start — see what it will do

Nothing here needs a credential:

```
cd C:\dev\dtc-app\functions
npm run dryrun
```

That runs the whole pipeline against the real roster (30 clients, 35 staff) and
a stand-in mailbox, and prints what would land in the review queue. Nothing is
written and nothing touches the network.

Read the output before going further. The part worth looking at is the
**ambiguous** section — `D Hardman`, `Carabajal`, `Rodriguez`, `Tisby`. Those
are the documents the system refuses to file on its own, and the reason it
refuses is the whole design. If that output looks wrong to you, stop here and
say so; it is much cheaper to change now than after documents are filed.

To check nothing has broken:

```
npm test
```

54 tests. They encode real cases from the CareTime rosters — if you change a
scoring constant in `matcher.mjs`, these are what tell you what you broke.

---

## Step 1 — Firebase service-account key

The functions write to Firestore and Storage as an administrator, so they need
a key file rather than a login.

1. Firebase console → the `dtcapp-24504` project → gear icon → **Project settings**
2. **Service accounts** tab → **Generate new private key** → Generate key
3. A `.json` file downloads. **Do not put it in the repo or in OneDrive.** Keep
   it somewhere private for the next few minutes; you'll paste its contents into
   Netlify and can then delete the file.

**Check:** the file opens as JSON and contains `"type": "service_account"` and a
`private_key` that starts with `-----BEGIN PRIVATE KEY-----`.

> If Netlify mangles the value on paste (multi-line values sometimes get
> mangled), base64-encode it instead — `firebase.mjs` accepts either. In
> PowerShell:
> `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\key.json"))`

---

## Step 2 — Microsoft Graph (needs a Microsoft 365 admin)

The poll runs on a schedule with nobody signed in, so it can't use a normal
login. It signs in *as an application*, which means an admin has to approve it
once.

1. **Register it.** Entra admin centre (entra.microsoft.com) → Applications →
   **App registrations** → **New registration**.
   - Name: `DTC ingestion`
   - Accounts: **single tenant**
   - Redirect URI: leave blank — there is no browser in this flow
   - Register

   Copy the **Application (client) ID** and **Directory (tenant) ID** off the
   overview page. You'll need both.

2. **Ask for the permission.** API permissions → Add a permission → Microsoft
   Graph → **Application permissions** (not Delegated) → search `Mail.Read` →
   Add.

3. **Consent to it.** Click **Grant admin consent for <your org>**.

   This is the step people miss. Adding a permission and consenting to it are
   two different actions, and without the second the poll fails with a 403 that
   looks like an empty inbox.

   **Check:** the Mail.Read row says *Granted for <your org>* with a green tick.

4. **Scope it to one mailbox. Do not skip this.**

   `Mail.Read` as an application permission reads **every mailbox in the
   tenant** — the owner's, HR's, everyone's. An application access policy
   narrows it to the intake mailbox. In Exchange Online PowerShell:

   ```powershell
   New-ApplicationAccessPolicy -AppId <client-id> `
     -PolicyScopeGroupId intake@daretocarehomecare.com `
     -AccessRight RestrictAccess `
     -Description "DTC ingestion - intake mailbox only"
   ```

   **Check:**
   ```powershell
   Test-ApplicationAccessPolicy -Identity intake@daretocarehomecare.com -AppId <client-id>
   # → AccessCheckResult : Granted
   Test-ApplicationAccessPolicy -Identity <some other mailbox> -AppId <client-id>
   # → AccessCheckResult : Denied     ← this is the one that matters
   ```

   The second result is the point. If it says Granted, the policy didn't apply
   and that client secret is a key to the whole organisation's email.

5. **Make a secret.** Certificates & secrets → New client secret → 12 or 24
   months → copy the **Value** column (not the Secret ID).

   It is shown once. If you navigate away without copying it, delete it and make
   another — there is no way to see it again.

   Put a note in a calendar for a month before it expires. An expired secret
   fails exactly like a quiet inbox.

---

## Step 2b — Survey the mailbox before wiring anything to it

You now have the Graph credential, and there is one question worth answering
with it before the poll ever runs: **does the agency receive documents that
have to be signed and sent back?**

Nobody could answer that from memory, and it decides whether a whole feature
gets built. So count it instead:

```
cd C:\dev\dtc-app\functions

# PowerShell — these live only in this window, nothing is saved
$env:GRAPH_TENANT_ID="..."
$env:GRAPH_CLIENT_ID="..."
$env:GRAPH_CLIENT_SECRET="..."
$env:DTC_MAILBOX="intake@daretocarehomecare.com"

npm run survey              # last 90 days
node survey.mjs --days 180  # or a wider window
```

It reads the Inbox and Sent Items, threads them together, and reports what
arrives, in what formats, and how often something goes back *out* with an
attachment on the same thread. That last number is the answer.

It writes nothing anywhere, and never downloads an attachment's contents — only
names, types and sizes. No message bodies are printed. It is also a good first
use of the credential precisely because it cannot change anything: if the
survey runs, the connection works.

**Read the sampled subjects, not just the counts.** The word-matching is crude,
and a reply with an attachment might be a forward rather than a signed return.

---

## Step 3 — Netlify environment variables

Netlify → the forms site → Site configuration → **Environment variables**.

| Variable | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the whole JSON from step 1 (or its base64) |
| `FIREBASE_STORAGE_BUCKET` | `dtcapp-24504.firebasestorage.app` |
| `GRAPH_TENANT_ID` | Directory (tenant) ID from step 2 |
| `GRAPH_CLIENT_ID` | Application (client) ID from step 2 |
| `GRAPH_CLIENT_SECRET` | the secret **Value** from step 2 |
| `DTC_MAILBOX` | `intake@daretocarehomecare.com` |
| `PREFLIGHT_KEY` | any long random string you invent — it guards step 4 |

Mark each **secret** where Netlify offers it, and scope them to production.

Then **redeploy**. Netlify only picks up environment variables at build time, so
a variable added after the last deploy isn't there yet.

---

## Step 4 — Ask it whether it's ready

This is why step 3 has a `PREFLIGHT_KEY`. Run:

```
curl -H "x-preflight-key: <your key>" ^
  https://forms.daretocarehomecare.com/.netlify/functions/preflight-ingestion
```

It checks each thing separately and tells you which one is wrong and how to fix
it. It reads one message header and writes nothing, so it is safe to run against
production as often as you like.

What you want:

```json
{ "ready": true, "checks": [ ... all "ok" ... ], "nextStep": null }
```

Common answers and what they mean:

| It says | What's actually wrong |
|---|---|
| Graph sign-in failed | Wrong or rotated client secret, or the wrong tenant ID |
| Mailbox access, 403 | Admin consent not granted, **or** the access policy excludes this mailbox |
| Mailbox access, 404 | `DTC_MAILBOX` isn't a real address. Shared mailboxes use their own address |
| Firestore: clients and users both empty | The migration hasn't run — everything will queue as unmatched |
| Storage: bucket does not exist | Firebase Storage may need the Blaze plan on this project |

Fix the **first** failure and run it again. The later ones are often downstream
of the first.

---

## Step 5 — the rules, before any real document is filed

Storage is still on console defaults. Real documents about real people should
not be filed until this runs:

```
firebase login
cd C:\dev\dtc-app
DEPLOY-RULES.bat
```

---

## Step 6 — the first real poll

Once preflight says `ready: true`, the schedule takes over: every 15 minutes,
about 2,900 runs a month against a free allowance of 125,000.

Watch the first one in Netlify → Functions → `poll-outlook` → the log. You are
looking for a line like:

```
Poll complete: 4 queued from 7 message(s) in 3120ms
```

Then open the app → **Office Manager → Inbound**. The queue is sorted
hardest-first on purpose: the entries needing a decision sit above the ones
needing only a confirming click, because a queue sorted newest-first teaches
people to click through the top of it without reading.

**On the very first run** it looks back 30 days, so expect a batch rather than a
trickle. After that it only sees new mail.

---

## What to watch in the first week

The one number worth reading is `resolutionKind` — whether the reviewer took the
suggestion or overrode it. That's the only honest measure of whether the matcher
is any good. If overrides cluster on one document type, the classifier needs a
rule, not the matcher.

And one gap worth knowing about now: **a referral with no attachment queues
nothing.** The owner said some referrals are one-line "call this person" emails.
Today those pass through silently. That is a real hole, and it's deliberate only
in the sense that nobody has decided yet what the queue entry should look like
when there is no document to file.

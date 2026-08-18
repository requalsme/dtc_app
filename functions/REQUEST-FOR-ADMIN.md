# Request: read access to the intake mailbox

_For whoever administers Microsoft 365 for daretocarehomecare.com — likely
Rejane or Kevan, possibly an outside IT contractor._

_Raina: this is written to be forwarded. Everything below is meant for them to
read, so it explains the background rather than assuming it._

---

## What I'm asking for

Permission for one small program to **read** the `intake@daretocarehomecare.com`
mailbox, so that documents arriving by email get filed onto the right person's
record automatically instead of by hand.

It takes about 15 minutes in the Microsoft admin centre. It needs someone with
Global Administrator or Application Administrator rights — I don't have those,
which is why this is coming to you.

## Why

Right now the agency's compliance evidence lives **only in email**. CareTime
holds no documents at all for any of the 50 people on the roster — no background
checks, no certifications, no authorizations. If a surveyor asks for a
caregiver's CBI result, the answer is currently "somewhere in the inbox".

This puts those documents somewhere they can be produced on demand, filed under
the person they belong to.

## What it will and will not do

**It will:** read messages in that one mailbox every 15 minutes, take a copy of
any attached document, work out who it's probably about, and put it in a review
queue for an office manager.

**It will not:**

- Send email. It's asking for read permission only — there is no ability to
  send, reply, or forward anything.
- Delete or move anything. Every message stays exactly where it is, unread
  status included.
- Touch any other mailbox. See the scoping step below — this is the part I'd
  most like you not to skip.
- File anything on its own. It proposes who a document belongs to; a person
  reviews every single one and clicks. Nobody is marked compliant automatically.

## The steps

### 1. Register the application

Entra admin centre (**entra.microsoft.com**) → Applications → **App
registrations** → **New registration**

- Name: `DTC ingestion`
- Supported account types: **Accounts in this organizational directory only**
  (single tenant)
- Redirect URI: leave blank
- **Register**

### 2. Add the permission

In the new registration → **API permissions** → Add a permission → **Microsoft
Graph** → **Application permissions** (not Delegated) → search `Mail.Read` →
Add permission.

### 3. Grant consent

Click **Grant admin consent for <organisation>**.

This is a separate action from adding the permission, and it's the one that's
easy to miss. Without it the program fails silently — it looks like an empty
inbox rather than an error.

**Check:** the `Mail.Read` row should read *Granted for <organisation>* with a
green tick.

### 4. Restrict it to the one mailbox — please don't skip this

As granted above, `Mail.Read` lets the application read **every mailbox in the
organisation**. That's how Microsoft's application permissions work by default,
and it is far more access than this needs.

An application access policy narrows it to the intake mailbox. In Exchange
Online PowerShell:

```powershell
New-ApplicationAccessPolicy -AppId <client-id> `
  -PolicyScopeGroupId intake@daretocarehomecare.com `
  -AccessRight RestrictAccess `
  -Description "DTC ingestion - intake mailbox only"
```

**Check both of these:**

```powershell
Test-ApplicationAccessPolicy -Identity intake@daretocarehomecare.com -AppId <client-id>
# expect: AccessCheckResult : Granted

Test-ApplicationAccessPolicy -Identity <any other mailbox> -AppId <client-id>
# expect: AccessCheckResult : Denied
```

The second one is the one that matters. If it comes back *Granted*, the policy
didn't apply, and the credential from step 5 would be a key to the whole
organisation's email.

### 5. Create a client secret

In the registration → **Certificates & secrets** → **New client secret** → 12 or
24 months → copy the **Value** column (not the Secret ID).

It is displayed once. If it's lost, delete it and create another.

---

## What to send back

Two things, which are **not secret** and can go in an ordinary email:

- **Directory (tenant) ID** — on the registration's Overview page
- **Application (client) ID** — same page

And one thing that **is** a password to that mailbox:

- **The client secret value**

Please don't email the secret. Better options, roughly in order:

1. Enter it directly into Netlify yourself (Site configuration → Environment
   variables → `GRAPH_CLIENT_SECRET`, marked secret) and tell me it's done.
2. Send it through a password manager's secure share, or 1Password/Bitwarden.
3. Failing both, a phone call.

If it does end up somewhere it shouldn't, it can be deleted and regenerated in
under a minute — so say so rather than hoping.

## Also worth putting in a calendar

The secret expires on whatever date you choose in step 5. When it does, document
filing stops — and it stops *quietly*, looking exactly like a week with no post.
A reminder a month before is worth setting.

---

## How I'll check it worked

Once I have the tenant ID and client ID (and the secret is in place), there's a
read-only check that verifies each piece separately and reports which one is
wrong. Then a survey that reads the mailbox and reports what's in it —
also read-only, and it downloads no attachment contents.

Neither writes anything. If either of them runs at all, the connection is good.

// Is this thing actually wired up?
//
// Six environment variables, an Entra app registration, an admin consent, a
// mailbox policy and a service-account key all have to be right before the poll
// does anything useful — and when one of them is wrong, the poll's symptom is
// an empty queue, which is exactly what a quiet week looks like.
//
// So: a read-only check that answers each question separately and says what to
// fix. It reads one message header at most and writes nothing, anywhere.

import { getToken, listMessagesSince } from "./graph.mjs";

const REQUIRED = [
  ["FIREBASE_SERVICE_ACCOUNT", "Firebase console → Project settings → Service accounts → Generate new private key"],
  ["FIREBASE_STORAGE_BUCKET", "dtcapp-24504.firebasestorage.app"],
  ["GRAPH_TENANT_ID", "Entra admin centre → the app registration → Directory (tenant) ID"],
  ["GRAPH_CLIENT_ID", "Entra admin centre → the app registration → Application (client) ID"],
  ["GRAPH_CLIENT_SECRET", "Entra → the app registration → Certificates & secrets. Shown once."],
  ["DTC_MAILBOX", "e.g. intake@daretocarehomecare.com"],
];

const ok = (name, detail) => ({ name, status: "ok", detail });
const bad = (name, detail, fix) => ({ name, status: "failed", detail, fix });

/**
 * @param {{db?: object, bucket?: object}} ctx  optional; skipped if absent
 * @param {Record<string,string|undefined>} env
 */
export async function preflight(ctx = {}, env = process.env) {
  const checks = [];

  // 1. Variables present. Cheap, and the cause of most of it.
  const missing = REQUIRED.filter(([k]) => !env[k]);
  checks.push(
    missing.length
      ? bad(
          "Environment variables",
          `${missing.length} of ${REQUIRED.length} missing: ${missing.map(([k]) => k).join(", ")}`,
          missing.map(([k, where]) => `${k} — ${where}`).join("\n"),
        )
      : ok("Environment variables", `all ${REQUIRED.length} present`),
  );
  if (missing.length) return summarise(checks);

  // 2. Can we get a token at all? Separates "wrong secret" from "wrong permission".
  let token;
  try {
    token = await getToken({
      tenantId: env.GRAPH_TENANT_ID,
      clientId: env.GRAPH_CLIENT_ID,
      clientSecret: env.GRAPH_CLIENT_SECRET,
    });
    checks.push(ok("Graph sign-in", "client credentials accepted"));
  } catch (err) {
    checks.push(
      bad(
        "Graph sign-in",
        String(err?.message || err),
        "Usually a rotated or mistyped client secret, or the wrong tenant ID. " +
          "Secret values are shown once — if it was not copied, make a new one.",
      ),
    );
    return summarise(checks);
  }

  // 3. Can it read the one mailbox it is supposed to read?
  try {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const messages = await listMessagesSince(token, env.DTC_MAILBOX, since, 1);
    checks.push(
      ok(
        "Mailbox access",
        messages.length
          ? `${env.DTC_MAILBOX} readable; most recent message ${messages[0].receivedDateTime}`
          : `${env.DTC_MAILBOX} readable; nothing in the last 7 days`,
      ),
    );
  } catch (err) {
    const status = err?.status;
    checks.push(
      bad(
        "Mailbox access",
        String(err?.message || err),
        status === 403
          ? "Mail.Read is granted but not consented, or the application access policy excludes this mailbox. " +
            "Check API permissions shows 'Granted for <tenant>' — adding the permission is not the same as consenting to it."
          : status === 404
            ? `No mailbox named ${env.DTC_MAILBOX}. Shared mailboxes are addressed by their own address, not an owner's.`
            : "Check DTC_MAILBOX is the full address.",
      ),
    );
  }

  // 4. Firestore and Storage, if a handle was passed. A read and a metadata
  //    call — nothing is created, so running this against production is safe.
  if (ctx.db) {
    try {
      const snap = await ctx.db.collection("clients").limit(1).get();
      const users = await ctx.db.collection("users").limit(1).get();
      checks.push(
        snap.empty && users.empty
          ? bad(
              "Firestore",
              "connected, but clients and users are both empty",
              "The migration has not been run — the matcher has nothing to match against, " +
                "so everything will queue as unmatched. See migration/README.md.",
            )
          : ok("Firestore", "clients and users readable"),
      );
    } catch (err) {
      checks.push(bad("Firestore", String(err?.message || err), "Check the service-account JSON is intact."));
    }
  }

  if (ctx.bucket) {
    try {
      const [exists] = await ctx.bucket.exists();
      checks.push(
        exists
          ? ok("Storage", `${ctx.bucket.name} reachable`)
          : bad(
              "Storage",
              `${ctx.bucket.name} does not exist`,
              "Projects created after ~Oct 2024 need the Blaze plan to use Cloud Storage at all. " +
                "Without it the queue can record that a document arrived but cannot keep the document.",
            ),
      );
    } catch (err) {
      checks.push(bad("Storage", String(err?.message || err), "Check FIREBASE_STORAGE_BUCKET."));
    }
  }

  return summarise(checks);
}

function summarise(checks) {
  const failed = checks.filter((c) => c.status === "failed");
  return {
    ready: failed.length === 0,
    checks,
    // The first failure is the one to fix; the rest are often downstream of it.
    nextStep: failed[0] ? `${failed[0].name}: ${failed[0].fix}` : null,
  };
}

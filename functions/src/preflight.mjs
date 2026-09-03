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
  ["SUPABASE_URL", "Supabase dashboard → Project settings → API → Project URL"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase dashboard → Project settings → API → service_role. Never expose to a browser."],
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

  // 4. Database and Storage, if a handle was passed. A read and a listing —
  //    nothing is created, so running this against production is safe.
  if (ctx.sb) {
    try {
      const clients = await ctx.sb.from("clients").select("id").limit(1);
      const users = await ctx.sb.from("users").select("id").limit(1);
      if (clients.error || users.error) throw new Error(clients.error?.message || users.error?.message);
      checks.push(
        !clients.data?.length && !users.data?.length
          ? bad(
              "Database",
              "connected, but clients and users are both empty",
              "The migration has not been run — the matcher has nothing to match against, " +
                "so everything will queue as unmatched. See migration/README.md.",
            )
          : ok("Database", "clients and users readable"),
      );
    } catch (err) {
      checks.push(
        bad("Database", String(err?.message || err), "Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."),
      );
    }

    try {
      // Listing the buckets proves both that the key works for Storage and that
      // the three the pipeline needs actually exist.
      const { data: buckets, error } = await ctx.sb.storage.listBuckets();
      if (error) throw new Error(error.message);
      const names = new Set((buckets || []).map((b) => b.name));
      const missing = ["filed", "inbound", "courses"].filter((b) => !names.has(b));
      checks.push(
        missing.length === 0
          ? ok("Storage", "filed, inbound and courses buckets reachable")
          : bad(
              "Storage",
              `missing bucket(s): ${missing.join(", ")}`,
              "Run supabase/storage.sql against the project. Without these the queue can " +
                "record that a document arrived but cannot keep the document.",
            ),
      );
    } catch (err) {
      checks.push(bad("Storage", String(err?.message || err), "Check the service-role key."));
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

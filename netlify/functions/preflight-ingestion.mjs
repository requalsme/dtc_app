// GET /.netlify/functions/preflight-ingestion
//
// Answers "is the ingestion actually wired up?" without queueing anything.
//
// This exists because the poll's failure mode is silence. A wrong client
// secret, a Mail.Read permission that was added but never consented to, an
// application access policy that excludes the intake mailbox, a service-account
// key that Netlify mangled on paste — every one of those produces an empty
// review queue, and an empty review queue is also what a quiet week looks like.
// The difference only becomes visible during a survey, which is the worst
// possible time to find out.
//
// Read-only: it reads at most one message header and writes nothing anywhere,
// so it is safe to run against production.
//
// Guarded by a shared key rather than a signed-in reviewer, deliberately. The
// whole point is to be able to run it when Supabase itself is misconfigured,
// and reviewer auth needs Supabase to work. Set PREFLIGHT_KEY in Netlify; with
// it unset the endpoint refuses to run rather than defaulting to open, because
// its output is a map of what is and isn't configured.

import { preflight } from "../../functions/src/preflight.mjs";

export default async function handler(request) {
  const expected = process.env.PREFLIGHT_KEY;
  if (!expected) {
    return json(
      { error: "PREFLIGHT_KEY is not set. Set it in Netlify to enable this endpoint." },
      503,
    );
  }
  if (request.headers.get("x-preflight-key") !== expected) {
    return json({ error: "Not authorised." }, 401);
  }

  // The database and Storage are checked only if a client can be built at all.
  // Failing to build one is itself a finding, not a crash.
  let ctx = {};
  let credentialError = null;
  try {
    const { supabaseAdmin } = await import("../../functions/src/supabase.mjs");
    ctx = supabaseAdmin();
  } catch (err) {
    credentialError = String(err?.message || err);
  }

  const result = await preflight(ctx);

  if (credentialError) {
    result.ready = false;
    result.checks.push({
      name: "Supabase credentials",
      status: "failed",
      detail: credentialError,
      fix: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in Netlify. " +
        "Find them in the Supabase dashboard under Project settings → API.",
    });
    result.nextStep ||= `Supabase credentials: ${credentialError}`;
  }

  // 200 either way. This endpoint succeeded at its job even when the answer is
  // "no" — a non-2xx here would read as "the check is broken", which is a
  // different problem and would send someone looking in the wrong place.
  return json(result);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

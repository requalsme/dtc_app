// Supabase admin access, from a service-role key in an environment variable.
//
// This is what makes the ingestion pipeline portable. It runs anywhere that can
// hold a secret and run Node — Netlify, GitHub Actions, a laptop — which is the
// same reason the Firebase version read a service-account key from the
// environment rather than relying on a Cloud Function's ambient credentials.
//
// THE SERVICE-ROLE KEY BYPASSES ROW LEVEL SECURITY. Every policy in
// supabase/schema.sql is invisible to this client, which is exactly why the
// ingestion endpoints re-check the caller's role themselves (see auth.mjs)
// rather than leaning on the database to refuse. It must never be sent to a
// browser: the frontend gets the anon key, whose every action is still decided
// by RLS.

import { createClient } from "@supabase/supabase-js";

let cached = null;

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Find it in the Supabase dashboard under ` +
        `Project settings → API, and store it in that variable.`,
    );
  }
  return value;
}

/** Lazily initialise, and reuse across warm invocations. */
export function supabaseAdmin() {
  if (cached) return cached;

  const sb = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  cached = { sb, storage: sb.storage };
  return cached;
}

/** Storage buckets, one per prefix Firebase used to keep as a folder. */
export const BUCKETS = {
  filed: "filed",
  inbound: "inbound",
  courses: "courses",
};

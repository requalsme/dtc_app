import { createClient } from "@supabase/supabase-js";

// The anon key is a public value — it identifies the project and nothing more.
// Every read and write it can perform is decided by Row Level Security in
// Postgres, not by possession of this key. The service-role key, which does
// bypass RLS, is never shipped to a browser; it exists only in Netlify function
// environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Failing loudly here beats a hundred confusing "Invalid API key" responses
  // from every query in the app.
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set. " +
      "Copy .env.example to .env for local development, and set both in Netlify for deploys.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The session is what authenticates the app to the Netlify functions too
    // (its access token travels as a Bearer header), so keeping it fresh
    // matters beyond just staying signed in.
    detectSessionInUrl: true,
  },
});

/** Storage buckets, one per prefix Firebase used to keep as a folder. */
export const BUCKETS = {
  filed: "filed",
  inbound: "inbound",
  courses: "courses",
} as const;

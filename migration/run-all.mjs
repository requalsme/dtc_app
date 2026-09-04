// The whole migration, in one command.
//
//   node migration/run-all.mjs            # do it
//   node migration/run-all.mjs --dry-run  # say what it would do, touch nothing
//
// Runs every step that does not require someone's identity:
//
//   1. apply supabase/schema.sql   (tables, RLS, triggers)
//   2. apply supabase/storage.sql  (buckets and their policies)
//   3. export everything out of Firebase   — READ-ONLY against Firebase
//   4. import it into Supabase
//   5. verify, and print what landed
//
// Nothing here deletes anything from Firebase. Turning the old project off is a
// separate decision, made after this has been checked by a person.
//
// Resumable: step 3 skips an export that already exists (pass --re-export to
// force a fresh one), and step 4 upserts on the original ids, so a run that
// fails halfway can simply be run again.

import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");
const RE_EXPORT = process.argv.includes("--re-export");

// ── Configuration ──────────────────────────────────────────────────────────
// Read from the environment, falling back to .env so this works with a file
// the way the rest of the project does.
async function loadEnv() {
  try {
    const text = await readFile(join(ROOT, ".env"), "utf8");
    for (const line of text.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  } catch {
    /* no .env is fine if the variables are already exported */
  }
}

const REQUIRED = {
  SUPABASE_DB_URL:
    "Supabase dashboard → Project settings → Database → Connection string → URI\n" +
    "      (the postgresql://... one, with your database password substituted in)",
  SUPABASE_URL: "Supabase dashboard → Project settings → API → Project URL",
  SUPABASE_SERVICE_ROLE_KEY:
    "Supabase dashboard → Project settings → API → service_role (keep this secret)",
  FIREBASE_SERVICE_ACCOUNT:
    "the existing Firebase key, e.g.  netlify env:get FIREBASE_SERVICE_ACCOUNT",
};

function checkConfig() {
  const missing = Object.entries(REQUIRED).filter(([name]) => !process.env[name]);
  if (!missing.length) return true;

  console.error("\nMissing configuration. Add these to .env in the repo root:\n");
  for (const [name, where] of missing) console.error(`  ${name}\n      ${where}\n`);
  console.error(
    "The first three come from a Supabase project, which has to be created by\n" +
      "hand at supabase.com — that part needs your account, not a script.\n",
  );
  return false;
}

// ── Steps ──────────────────────────────────────────────────────────────────

function step(n, title) {
  console.log(`\n${"─".repeat(70)}\n${n}. ${title}\n${"─".repeat(70)}`);
}

/** Apply one .sql file over a direct Postgres connection. */
async function applySql(file) {
  const sql = await readFile(join(ROOT, "supabase", file), "utf8");
  if (DRY) {
    console.log(`  [dry-run] would apply supabase/${file} (${sql.length} bytes)`);
    return;
  }

  // Imported here rather than at the top so --dry-run and the config check work
  // even before `npm install` has fetched it.
  const { default: postgres } = await import("postgres");
  const client = postgres(process.env.SUPABASE_DB_URL, {
    max: 1,
    // Supabase's pooler presents a certificate for its own hostname; this is a
    // direct admin connection over TLS, not an unencrypted one.
    ssl: "require",
    onnotice: () => {},
  });

  try {
    // The whole file as one statement batch, so `$$ ... $$` function bodies are
    // not split on the semicolons inside them.
    await client.unsafe(sql);
    console.log(`  applied supabase/${file}`);
  } finally {
    await client.end();
  }
}

/** Run one of the sibling scripts as a child process, streaming its output. */
function run(script, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join("migration", script)], {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} exited with code ${code}`)),
    );
    child.on("error", reject);
  });
}

async function exportExists() {
  try {
    await stat(join(ROOT, "migration", "export", "export-summary.json"));
    return true;
  } catch {
    return false;
  }
}

/** Read back what actually landed, so the run ends in evidence rather than hope. */
async function verify() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tables = [
    "users", "clients", "templates", "submissions", "documents",
    "audit", "tasks", "certificates", "course_handoffs", "course_progress",
    "inbound", "applications", "app_metadata",
  ];

  console.log("\n  Rows now in Supabase:");
  for (const table of tables) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
    console.log(`    ${table.padEnd(18)} ${error ? `ERROR — ${error.message}` : count}`);
  }

  const { data: buckets } = await sb.storage.listBuckets();
  const names = (buckets || []).map((b) => b.name);
  console.log(`\n  Storage buckets: ${names.length ? names.join(", ") : "NONE — storage.sql did not apply"}`);

  // The two junk CareTime records must not have made it across.
  const { data: junk } = await sb
    .from("clients")
    .select("id, name, data")
    .in("data->>caretimeId", ["248760", "260924"]);
  console.log(
    junk?.length
      ? `\n  ! ${junk.length} CareTime test record(s) present — expected 0`
      : "\n  CareTime test records: correctly absent",
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  await loadEnv();

  console.log(DRY ? "\nDRY RUN — nothing will be written.\n" : "\nFirebase → Supabase migration\n");
  if (!checkConfig()) process.exit(1);

  step(1, "Schema, Row Level Security and triggers");
  await applySql("schema.sql");

  step(2, "Storage buckets and policies");
  await applySql("storage.sql");

  step(3, "Export from Firebase (read-only)");
  if (DRY) {
    console.log("  [dry-run] would export every collection and every stored file");
  } else if ((await exportExists()) && !RE_EXPORT) {
    console.log("  migration/export/ already exists — reusing it.");
    console.log("  (pass --re-export to pull a fresh copy from Firebase)");
  } else {
    await run("export-firebase.mjs");
  }

  step(4, "Import into Supabase");
  if (DRY) {
    console.log("  [dry-run] would create auth accounts, load every table, upload every file");
  } else {
    await run("import-supabase.mjs");
  }

  step(5, "Verify");
  if (DRY) {
    console.log("  [dry-run] would count every table and list the buckets");
  } else {
    await verify();
  }

  console.log(`\n${"─".repeat(70)}`);
  if (DRY) {
    console.log("Dry run complete. Re-run without --dry-run to do it for real.");
    return;
  }

  console.log(`Migration complete.

Still to do, by hand:
  1. Authentication → Providers: enable Anonymous sign-ins (the course site
     needs it), and configure an SMS provider if phone login is to keep working.
  2. Send everyone a password reset. Firebase password hashes cannot transfer,
     so nobody can log in until they set a new one.
  3. Set the Netlify environment variables from .env.example.
  4. Walk the app as each role before trusting it.

Keep migration/export/ — after Firebase is switched off it is the only copy of
the old state. It is gitignored because it holds real client records.`);
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  console.error("Nothing was deleted from Firebase. Fix the cause and run this again.");
  process.exit(1);
});

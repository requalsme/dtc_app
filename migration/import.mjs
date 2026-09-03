// CareTime -> DTC app migration.
//
//   node migration/import.mjs clients --dry-run
//   node migration/import.mjs clients
//   node migration/import.mjs staff --dry-run
//   node migration/import.mjs staff
//
// Clients import straight into the `clients` table - no auth involved.
//
// Staff are different: the app keys `users` rows by auth account id, so
// importing a staff member means creating a real login. That is a side-effecting
// operation (it can trigger password-reset email), so staff import is a two-step
// process and never runs implicitly:
//   1. `staff --dry-run` writes migration/staff-plan.json for review.
//   2. `staff` creates the accounts from that reviewed plan.
//
// Requires the service-role key so this can run outside the browser:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
// Both are in the Supabase dashboard under Project settings > API.

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const [, , target, ...flags] = process.argv;
const DRY = flags.includes("--dry-run");

if (!["clients", "staff"].includes(target)) {
  console.error("Usage: node migration/import.mjs <clients|staff> [--dry-run]");
  process.exit(1);
}

// ── Supabase ────────────────────────────────────────────────────────────────
// Runs under the service-role key, which bypasses RLS. That is correct for a
// local one-off import and is why this is a script rather than an endpoint.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Look up an auth account by email. There is no getUserByEmail, so this pages
 *  the admin list once and indexes it — cheaper than a call per person, and
 *  this roster is a few dozen people. */
let authByEmail = null;
async function findAuthUser(email) {
  if (!authByEmail) {
    authByEmail = new Map();
    const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users || []) {
      if (u.email) authByEmail.set(u.email.toLowerCase(), u.id);
    }
  }
  return authByEmail.get(String(email).toLowerCase()) || null;
}

const load = (f) => JSON.parse(readFileSync(join(HERE, f), "utf8"));
const initialsOf = (name) =>
  (name || "?").split(/\s+/).map((s) => s[0]).join("").toUpperCase().slice(0, 2) || "?";

// ── Clients ─────────────────────────────────────────────────────────────────
async function importClients() {
  const { clients } = load("caretime-clients.json");

  // Match on name so re-running updates rather than duplicating.
  const { data: existing } = await sb.from("clients").select("id, name");
  const byName = new Map((existing || []).map((r) => [String(r.name || "").toLowerCase(), r.id]));

  let created = 0, updated = 0;
  for (const c of clients) {
    const doc = {
      name: c.name,
      // Placeholder CareTime addresses must never be treated as contactable.
      email: c.emailIsPlaceholder ? null : c.email,
      city: c.city || null,
      zip: c.zip || null,
      county: c.county || null,
      payerType: c.type || null,
      livesAlone: !!c.livesAlone,
      serviceCoordinator: c.serviceCoordinator || null,
      status: "active",
      initials: initialsOf(c.name),
      source: "caretime-import",
      importedAt: new Date().toISOString(),
      // Present in the app's client model but not on CareTime's list view.
      // Left null on purpose so autofill shows a gap rather than wrong data.
      dob: null, mrn: null, physician: null, allergies: null,
    };

    // `name` and `status` are promoted columns; everything else stays in the
    // jsonb document, matching how the app writes clients (supabase/schema.sql).
    const { name, status, ...rest } = doc;
    const row = { name, status, data: rest };

    const hitId = byName.get(c.name.toLowerCase());
    if (hitId) {
      updated++;
      // upsert on the existing id merges rather than duplicating, which is what
      // `set(..., { merge: true })` did.
      if (!DRY) await sb.from("clients").upsert({ id: hitId, ...row });
    } else {
      created++;
      if (!DRY) await sb.from("clients").insert({ id: randomUUID(), ...row });
    }
  }
  console.log(`${DRY ? "[dry-run] " : ""}clients: ${created} new, ${updated} updated (${clients.length} total)`);
}

// ── Staff ───────────────────────────────────────────────────────────────────
async function importStaff() {
  const data = load("caretime-staff.json");
  const roleFor = (title) => data._roleMapping[title] || "caregiver";

  const plan = [];
  for (const s of data.staff) {
    const issues = [];
    if (s.emailNeedsFix) issues.push(`malformed email; suggested: ${s.emailSuggested}`);
    if (!s.email) issues.push("no email - cannot create a login");

    let existingUid = null;
    if (s.email && !s.emailNeedsFix) {
      existingUid = await findAuthUser(s.email);
    }

    plan.push({
      name: s.name,
      email: s.emailNeedsFix ? s.emailSuggested : s.email,
      role: roleFor(s.title),
      caretimeId: s.caretimeId,
      phone: s.phone || null,
      city: s.city || null,
      zip: s.zip || null,
      existingUid,
      issues,
      action: issues.length ? "SKIP" : existingUid ? "LINK_EXISTING" : "CREATE",
    });
  }

  if (DRY) {
    writeFileSync(join(HERE, "staff-plan.json"), JSON.stringify(plan, null, 2));
    const by = (a) => plan.filter((p) => p.action === a).length;
    console.log(`[dry-run] staff plan written to migration/staff-plan.json`);
    console.log(`  CREATE: ${by("CREATE")}   LINK_EXISTING: ${by("LINK_EXISTING")}   SKIP: ${by("SKIP")}`);
    plan.filter((p) => p.issues.length).forEach((p) => console.log(`  ! ${p.name}: ${p.issues.join("; ")}`));
    console.log(`\nReview the plan, then re-run without --dry-run to create accounts.`);
    return;
  }

  for (const p of plan) {
    if (p.action === "SKIP") { console.log(`skip  ${p.name} (${p.issues.join("; ")})`); continue; }

    let uid = p.existingUid;
    if (!uid) {
      // Random password: the user never uses it. They set their own via the
      // reset link, and mustChangePassword gates the app until they do.
      const tempPassword = `Dtc!${Math.random().toString(36).slice(2, 10)}A1`;
      const { data: created, error } = await sb.auth.admin.createUser({
        email: p.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: p.name, role: p.role },
      });
      if (error) { console.log(`skip  ${p.name} (${error.message})`); continue; }
      uid = created.user.id;
    }

    // Upsert, not insert: the on_auth_user_created trigger already made a bare
    // row the instant the account existed. devAccess is deliberately absent —
    // it is granted by hand, never as part of an import.
    await sb.from("users").upsert({
      id: uid,
      name: p.name,
      email: p.email.toLowerCase(),
      role: p.role,
      status: "active",
      must_change_password: true,
      created_at: new Date().toISOString(),
      last_login_at: null,
      data: {
        initials: initialsOf(p.name),
        phone: p.phone,
        city: p.city,
        zip: p.zip,
        caretimeId: p.caretimeId,
        source: "caretime-import",
      },
    });

    console.log(`${p.existingUid ? "link " : "create"} ${p.name} (${p.role})`);
  }

  console.log(`\nAccounts created WITHOUT sending email. To invite people, send`);
  console.log(`password-reset links from the app's Team screen when you're ready.`);
}

await (target === "clients" ? importClients() : importStaff());

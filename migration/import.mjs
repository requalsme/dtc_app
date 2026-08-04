// CareTime -> DTC app migration.
//
//   node migration/import.mjs clients --dry-run
//   node migration/import.mjs clients
//   node migration/import.mjs staff --dry-run
//   node migration/import.mjs staff
//
// Clients import straight into the `clients` collection - no auth involved.
//
// Staff are different: the app keys `users` documents by Firebase Auth UID, so
// importing a staff member means creating a real login. That is a side-effecting
// operation (it can trigger password-reset email), so staff import is a two-step
// process and never runs implicitly:
//   1. `staff --dry-run` writes migration/staff-plan.json for review.
//   2. `staff` creates the accounts from that reviewed plan.
//
// Requires a service-account key so this can run outside the browser:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
// Get one from Firebase console > Project settings > Service accounts.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const HERE = dirname(fileURLToPath(import.meta.url));
const [, , target, ...flags] = process.argv;
const DRY = flags.includes("--dry-run");

if (!["clients", "staff"].includes(target)) {
  console.error("Usage: node migration/import.mjs <clients|staff> [--dry-run]");
  process.exit(1);
}

// ── Firebase ────────────────────────────────────────────────────────────────
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
initializeApp({
  credential: keyPath ? cert(JSON.parse(readFileSync(keyPath, "utf8"))) : applicationDefault(),
});
const db = getFirestore();
const auth = getAuth();

const load = (f) => JSON.parse(readFileSync(join(HERE, f), "utf8"));
const initialsOf = (name) =>
  (name || "?").split(/\s+/).map((s) => s[0]).join("").toUpperCase().slice(0, 2) || "?";

// ── Clients ─────────────────────────────────────────────────────────────────
async function importClients() {
  const { clients } = load("caretime-clients.json");

  // Match on name so re-running updates rather than duplicating.
  const existing = await db.collection("clients").get();
  const byName = new Map(existing.docs.map((d) => [String(d.data().name || "").toLowerCase(), d]));

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

    const hit = byName.get(c.name.toLowerCase());
    if (hit) {
      updated++;
      if (!DRY) await hit.ref.set(doc, { merge: true });
    } else {
      created++;
      if (!DRY) await db.collection("clients").add(doc);
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
      try { existingUid = (await auth.getUserByEmail(s.email)).uid; } catch { /* no account yet */ }
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
      uid = (await auth.createUser({ email: p.email, password: tempPassword, displayName: p.name })).uid;
    }

    await db.collection("users").doc(uid).set({
      name: p.name,
      email: p.email.toLowerCase(),
      role: p.role,
      initials: initialsOf(p.name),
      status: "active",
      mustChangePassword: true,
      phone: p.phone,
      city: p.city,
      zip: p.zip,
      caretimeId: p.caretimeId,
      source: "caretime-import",
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    }, { merge: true });

    console.log(`${p.existingUid ? "link " : "create"} ${p.name} (${p.role})`);
  }

  console.log(`\nAccounts created WITHOUT sending email. To invite people, send`);
  console.log(`password-reset links from the app's Team screen when you're ready.`);
}

await (target === "clients" ? importClients() : importStaff());

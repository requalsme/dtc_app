// Does the migrated security model actually behave the way firestore.rules did?
//
// Applying a schema without errors proves the SQL parsed. It does not prove the
// policies say what the old rules said - a policy can be syntactically perfect
// and still let the wrong person read a care plan. This asks the database what
// it will actually allow, using the same anon key a browser gets.
//
//   node supabase/verify-policies.mjs
//
// THE POINT OF THE SEEDING STEP: on an empty database, "the anon caller got
// zero rows" is indistinguishable from "the table was empty anyway", and a
// suite that cannot tell those apart passes whether or not the policies exist.
// So each table gets a probe row planted with the service-role key (which
// bypasses RLS) first, and is cleaned up afterwards. A refusal then means a
// refusal.

import { readFile } from "node:fs/promises";

const text = await readFile(new URL("../.env", import.meta.url), "utf8");
const env = {};
for (const line of text.split(/\r?\n/)) {
  if (/^\s*#/.test(line)) continue;
  const i = line.indexOf("=");
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const URL_ = env.SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const call = (key) => (path, init = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });

// A signed-out browser. Anything readable here is readable by the whole internet.
const anon = call(ANON);
const service = call(SERVICE);

const PROBE = "__rls_probe__";

// Only tables that take a row without a foreign key to a real auth account.
// users, documents and course_handoffs all reference auth.users, so they are
// covered by the manual role walkthrough after the import instead.
const SEEDABLE = {
  clients: { id: PROBE, name: "RLS probe" },
  templates: { id: PROBE, name: "RLS probe" },
  submissions: { id: PROBE, status: "submitted" },
  audit: { id: PROBE, action: "rls-probe" },
  tasks: { id: PROBE, status: "probe" },
  certificates: { id: PROBE, source: "course-site" },
  inbound: { id: PROBE, status: "pending" },
  applications: { id: PROBE, status: "submitted" },
  course_progress: { key: PROBE },
  courses: { id: PROBE, title: "RLS probe" },
};

const pkOf = (row) => ("key" in row ? "key" : "id");

async function seed() {
  const ok = [];
  for (const [table, row] of Object.entries(SEEDABLE)) {
    const r = await service(table, { method: "POST", body: JSON.stringify(row) });
    if (r.ok || r.status === 201) ok.push(table);
    else console.log(`  (could not seed ${table}: ${r.status} ${(await r.text()).slice(0, 80)})`);
  }
  return ok;
}

async function cleanup() {
  for (const [table, row] of Object.entries(SEEDABLE)) {
    await service(`${table}?${pkOf(row)}=eq.${PROBE}`, { method: "DELETE" });
  }
}

let pass = 0, fail = 0;
async function expect(label, fn, wanted) {
  const got = await fn();
  const ok = got === wanted;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (expected ${wanted}, got ${got})`}`);
  ok ? pass++ : fail++;
}

const anonSeesProbe = async (t) => {
  const pk = pkOf(SEEDABLE[t]);
  const r = await anon(`${t}?select=${pk}&${pk}=eq.${PROBE}`);
  if (!r.ok) return "denied";
  const j = await r.json();
  return Array.isArray(j) && j.length === 0 ? "denied" : "LEAKED";
};

const probeVisibleToService = async (t) => {
  const pk = pkOf(SEEDABLE[t]);
  const r = await service(`${t}?select=${pk}&${pk}=eq.${PROBE}`);
  const j = await r.json();
  return Array.isArray(j) && j.length === 1 ? "visible" : "not visible";
};

try {
  console.log("\nPlanting a probe row in each table (service key, bypasses RLS)\n");
  const seeded = await seed();
  console.log(`  seeded ${seeded.length} table(s)`);

  console.log("\nSanity check - the rows really are there\n");
  for (const t of seeded.slice(0, 3)) {
    await expect(`${t}: the planted probe really is there`, () => probeVisibleToService(t), "visible");
  }

  console.log("\nSigned-out (anon key) - a real row must still be invisible\n");
  for (const t of seeded) {
    await expect(`${t} hides the probe from a signed-out caller`, () => anonSeesProbe(t), "denied");
  }

  console.log("\nWrites a signed-out caller must not be able to make\n");
  const denied = async (path, body) => {
    const r = await anon(path, { method: "POST", body: JSON.stringify(body) });
    if (r.status === 401 || r.status === 403) return "denied";
    // Clean up anything that unexpectedly succeeded, so a failing test does not
    // leave a stray row behind.
    await service(`${path}?id=eq.${PROBE}2`, { method: "DELETE" });
    return `ALLOWED (${r.status})`;
  };
  await expect("cannot create a client", () => denied("clients", { id: PROBE + "2", name: "x" }), "denied");
  await expect("cannot create a submission", () => denied("submissions", { id: PROBE + "2", status: "submitted" }), "denied");
  await expect("cannot append to the audit log", () => denied("audit", { id: PROBE + "2", action: "x" }), "denied");
  await expect("cannot create an application", () => denied("applications", { id: PROBE + "2" }), "denied");
  await expect("cannot write the ingestion watermark", () => denied("app_metadata", { id: "ingestion", data: {} }), "denied");
} finally {
  await cleanup();
  console.log("\n  probe rows removed");
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (fail) {
  console.log("A failure means the migrated policies do NOT match the old rules.");
  process.exit(1);
}
console.log("Signed-out access matches the old rules. Role-level distinctions");
console.log("(staff vs caregiver vs dev) need real accounts and are covered by the");
console.log("manual walkthrough after the import.\n");

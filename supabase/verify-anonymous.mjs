// Can an anonymous session reach the clinical data?
//
// Supabase gives anonymous users the `authenticated` role, so every policy
// written `to authenticated` applies to them unless it says otherwise. The
// course site needs an anonymous session; nothing else should benefit from one.
//
// This signs in anonymously for real - the same thing the course site does -
// and asks what that session can actually see.

import { readFile } from "node:fs/promises";

const text = await readFile(new URL("../.env", import.meta.url), "utf8");
const env = {};
for (const line of text.split(/\r?\n/)) {
  if (/^\s*#/.test(line)) continue;
  const i = line.indexOf("=");
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const URL_ = env.SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const signIn = await fetch(`${URL_}/auth/v1/signup`, {
  method: "POST",
  headers: { apikey: ANON, "content-type": "application/json" },
  body: JSON.stringify({}),
}).then((r) => r.json());

const token = signIn.access_token;
if (!token) {
  console.log("Could not create an anonymous session:", JSON.stringify(signIn).slice(0, 200));
  process.exit(1);
}
const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
console.log(`\nSigned in anonymously. role=${claims.role} is_anonymous=${claims.is_anonymous}\n`);

const asAnon = (p) => fetch(`${URL_}/rest/v1/${p}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
const asService = (p, i = {}) => fetch(`${URL_}/rest/v1/${p}`, { ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json" } });

let pass = 0, fail = 0;
const check = async (label, table, shouldSee) => {
  const r = await asAnon(`${table}?select=*&limit=3`);
  const j = r.ok ? await r.json() : [];
  const sees = Array.isArray(j) && j.length > 0;
  const ok = sees === shouldSee;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (sees=${sees}, wanted ${shouldSee})`}`);
  ok ? pass++ : fail++;
};

console.log("Must be INVISIBLE to an anonymous session (real rows exist in each)\n");
for (const t of ["users", "clients", "templates", "submissions", "audit", "tasks", "applications"]) {
  await check(`${t} is hidden`, t, false);
}

console.log("\nMust stay VISIBLE - the course site depends on these\n");
// Seed one certificate so the check is not vacuous.
await asService("certificates", { method: "POST", body: JSON.stringify({ id: "__anon_probe__", source: "course-site" }) });
await check("certificates readable", "certificates", true);
await asService("certificates?id=eq.__anon_probe__", { method: "DELETE" });

await asService("course_progress", { method: "POST", body: JSON.stringify({ key: "__anon_probe__" }) });
await check("course_progress readable", "course_progress", true);
await asService("course_progress?key=eq.__anon_probe__", { method: "DELETE" });

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

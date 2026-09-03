// One-time import: load the Firebase export into Supabase.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node migration/import-supabase.mjs
//
// Runs under the service-role key, which bypasses RLS — that is deliberate and
// is why this is a local one-off script and not an endpoint. Idempotent: every
// write is an upsert keyed on the original id, so a failed run can be repeated
// without producing duplicates.
//
// THE ONE THING THAT CANNOT BE CARRIED OVER: passwords.
// Firebase hashes passwords with a project-specific scrypt variant. Those
// hashes are not portable to any other system, so every account is created here
// WITHOUT a usable password and flagged must_change_password. Everyone signs in
// once via a password-reset email. There is no way around this in any
// Firebase -> anywhere migration; it is a property of the hashing, not a
// shortcut being taken here.
//
// THE SECOND THING WORTH KNOWING: user ids change.
// A Firebase UID is a 28-character string; auth.users.id is a uuid. Accounts are
// therefore re-keyed, the old value is kept in users.legacy_uid, and every
// reference to a user anywhere else (caregiverId, subjectId, uploadedById,
// courseHandoffs.uid, deletedById) is rewritten through the map below. Records
// keyed by their own Firestore id — clients, submissions, documents — keep that
// id exactly, so references between THOSE are untouched.

import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = join(process.cwd(), "migration", "export");
const DOCS = join(OUT, "firestore");
const FILES = join(OUT, "storage");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const EXCLUDED_CLIENT_CARETIME_IDS = ["248760", "260924"];

async function load(name) {
  try {
    return JSON.parse(await readFile(join(DOCS, `${name}.json`), "utf8"));
  } catch {
    console.log(`  (no ${name}.json in the export — skipping)`);
    return [];
  }
}

// Split a Firestore document into the columns the schema promotes and the
// remainder, which is stored verbatim as jsonb. Promoted keys are REMOVED from
// the leftover so there is exactly one copy of each — a jsonb shadow of
// `status` or `caregiver_id` could drift out of step with the column an RLS
// policy actually reads, and silently wrong permissions are the worst kind.
function split(doc, mapping) {
  const promoted = {};
  const rest = { ...doc };
  delete rest.id;
  for (const [column, source] of Object.entries(mapping)) {
    const key = typeof source === "string" ? source : source.from;
    const transform = typeof source === "string" ? (v) => v : source.transform;
    if (key in rest) {
      promoted[column] = transform(rest[key]);
      delete rest[key];
    }
  }
  return { promoted, data: rest };
}

const iso = (v) => (v ? new Date(v).toISOString() : null);

async function upsert(table, rows) {
  if (!rows.length) {
    console.log(`  ${table}: nothing to import`);
    return;
  }
  // Batched: a few thousand audit rows in one request is a timeout waiting to
  // happen, and a partial failure is easier to place with smaller batches.
  const SIZE = 200;
  for (let i = 0; i < rows.length; i += SIZE) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + SIZE));
    if (error) throw new Error(`${table} rows ${i}-${i + SIZE}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} row(s)`);
}

// ── users ──────────────────────────────────────────────────────────────────
// Creates the auth account first, then the profile row keyed on it. Returns the
// old-uid -> new-uuid map every later step depends on.
async function importUsers() {
  const docs = await load("users");
  const map = {};
  let created = 0;
  let reused = 0;

  for (const doc of docs) {
    const email = doc.email?.trim().toLowerCase();
    if (!email) {
      console.warn(`  ! user ${doc.id} has no email — skipped (cannot create an auth account)`);
      continue;
    }

    // createUser fails if the address already exists, which is the expected
    // path on a re-run; fall back to looking the account up rather than
    // treating a repeat run as an error.
    const { data: createdUser, error } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: doc.name || "", legacy_uid: doc.id },
    });

    let authId = createdUser?.user?.id;
    if (error) {
      const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
      authId = list?.users?.find((u) => u.email?.toLowerCase() === email)?.id;
      if (!authId) {
        console.warn(`  ! ${email}: ${error.message}`);
        continue;
      }
      reused++;
    } else {
      created++;
    }

    map[doc.id] = authId;

    const { promoted, data } = split(doc, {
      name: "name",
      email: "email",
      role: "role",
      dev_access: { from: "devAccess", transform: (v) => v === true },
      status: "status",
      must_change_password: { from: "mustChangePassword", transform: (v) => v === true },
      courses_unlocked_at: { from: "coursesUnlockedAt", transform: iso },
      created_at: { from: "createdAt", transform: iso },
      last_login_at: { from: "lastLoginAt", transform: iso },
    });

    // The auth trigger already inserted a bare row; this fills it in.
    const { error: upErr } = await sb.from("users").upsert({
      id: authId,
      legacy_uid: doc.id,
      ...promoted,
      // Nobody arrives with a working password, so everyone is flagged to
      // change it regardless of what the old record said.
      must_change_password: true,
      data,
    });
    if (upErr) console.warn(`  ! profile for ${email}: ${upErr.message}`);
  }

  await writeFile(join(OUT, "id-map.json"), JSON.stringify(map, null, 2));
  console.log(`  users: ${created} created, ${reused} already existed → migration/export/id-map.json`);
  return map;
}

async function main() {
  console.log("Users (auth accounts + profiles):");
  const idMap = await importUsers();
  const uid = (old) => (old && idMap[old]) || null;

  // ── clients ──────────────────────────────────────────────────────────────
  console.log("\nCollections:");
  const clients = (await load("clients")).filter((c) => {
    const ct = String(c.caretimeId ?? c.careTimeId ?? "");
    if (EXCLUDED_CLIENT_CARETIME_IDS.includes(ct)) {
      console.log(`  - dropping CareTime test record ${ct} (${c.name || c.id})`);
      return false;
    }
    return true;
  });
  await upsert(
    "clients",
    clients.map((c) => {
      const { promoted, data } = split(c, {
        name: "name",
        status: "status",
        created_at: { from: "createdAt", transform: iso },
        updated_at: { from: "updatedAt", transform: iso },
      });
      return { id: c.id, ...promoted, data };
    }),
  );

  await upsert(
    "templates",
    (await load("templates")).map((t) => {
      const { promoted, data } = split(t, {
        name: "name",
        status: "status",
        version: "version",
        updated_at: { from: "updatedAt", transform: iso },
      });
      return { id: t.id, ...promoted, data };
    }),
  );

  // Storage paths are rewritten here: the old pdfUrl was a permanent Firebase
  // bearer token that stops working the moment the project goes, so it is
  // dropped rather than carried over dead. pdf_path is what the app now uses to
  // mint a short-lived signed URL at read time.
  await upsert(
    "submissions",
    (await load("submissions")).map((s) => {
      const { promoted, data } = split(s, {
        caregiver_id: { from: "caregiverId", transform: uid },
        caregiver_name: "caregiverName",
        client_id: "clientId",
        client_name: "clientName",
        schema_key: "schemaKey",
        template_name: "templateName",
        status: "status",
        submitted_at: { from: "submittedAt", transform: iso },
        subject_type: "subjectType",
        subject_id: { from: "subjectId", transform: (v) => (v == null ? null : String(v)) },
        pdf_path: { from: "pdfPath", transform: (p) => (p ? p.replace(/^filed\//, "") : null) },
        pdf_pending: { from: "pdfPending", transform: (v) => v === true },
        pdf_filed_at: { from: "pdfFiledAt", transform: iso },
        deleted_at: { from: "deletedAt", transform: iso },
        deleted_by: "deletedBy",
        deleted_by_id: { from: "deletedById", transform: uid },
        delete_reason: "deleteReason",
      });
      delete data.pdfUrl; // dead Firebase token
      // A staff-subject id is a user reference and has to follow the re-key.
      if (promoted.subject_type === "staff" && promoted.subject_id) {
        promoted.subject_id = uid(promoted.subject_id) || promoted.subject_id;
      }
      return { id: s.id, ...promoted, data };
    }),
  );

  await upsert(
    "documents",
    (await load("documents")).map((d) => {
      const { promoted, data } = split(d, {
        subject_type: "subjectType",
        subject_id: { from: "subjectId", transform: (v) => (v == null ? null : String(v)) },
        checklist_item_id: "checklistItemId",
        file_name: "fileName",
        content_type: "contentType",
        size: "size",
        storage_path: { from: "path", transform: (p) => (p ? p.replace(/^filed\//, "") : null) },
        document_date: "documentDate",
        note: "note",
        uploaded_by: "uploadedBy",
        uploaded_by_id: { from: "uploadedById", transform: uid },
        uploaded_at: { from: "uploadedAt", transform: iso },
        source: "source",
      });
      delete data.url; // dead Firebase token
      if (promoted.subject_type === "staff" && promoted.subject_id) {
        promoted.subject_id = uid(promoted.subject_id) || promoted.subject_id;
      }
      return { id: d.id, ...promoted, data };
    }),
  );

  await upsert(
    "tasks",
    (await load("tasks")).map((t) => {
      const { promoted, data } = split(t, {
        status: "status",
        due_date: "dueDate",
        created_at: { from: "createdAt", transform: iso },
      });
      return { id: t.id, ...promoted, data };
    }),
  );

  await upsert(
    "audit",
    (await load("audit")).map((a) => {
      const { promoted, data } = split(a, {
        action: "action",
        target: "target",
        detail: "detail",
        actor: "actor",
        role: "role",
        timestamp: { from: "timestamp", transform: iso },
      });
      return { id: a.id, ...promoted, data };
    }),
  );

  await upsert(
    "certificates",
    (await load("certificates")).map((c) => {
      const { promoted, data } = split(c, {
        user_id: { from: "uid", transform: uid },
        source: "source",
        passed: "passed",
        date: { from: "date", transform: iso },
      });
      // source is NOT NULL, and the policy that gates creation reads it.
      return { id: c.id, ...promoted, source: promoted.source || "course-site", data };
    }),
  );

  await upsert(
    "course_handoffs",
    (await load("courseHandoffs"))
      .map((h) => {
        const { promoted, data } = split(h, {
          uid: { from: "uid", transform: uid },
          created_at: { from: "createdAt", transform: iso },
        });
        return { token: h.id, ...promoted, data };
      })
      // uid is NOT NULL and FK-constrained; a handoff whose user did not
      // migrate is a dead one-time token and is not worth carrying.
      .filter((h) => h.uid),
  );

  await upsert(
    "course_progress",
    (await load("courseProgress")).map((p) => {
      const { promoted, data } = split(p, { updated_at: { from: "updatedAt", transform: iso } });
      // The key IS a user id, so it follows the re-key like every other one.
      return { key: uid(p.id) || p.id, ...promoted, data };
    }),
  );

  await upsert(
    "inbound",
    (await load("inbound")).map((i) => {
      const { promoted, data } = split(i, {
        status: "status",
        created_at: { from: "createdAt", transform: iso },
      });
      return { id: i.id, ...promoted, data };
    }),
  );

  await upsert(
    "applications",
    (await load("applications")).map((a) => {
      const { promoted, data } = split(a, {
        status: "status",
        reviewed_at: { from: "reviewedAt", transform: iso },
        reviewed_by: "reviewedBy",
        review_note: "reviewNote",
        created_at: { from: "createdAt", transform: iso },
      });
      // The applicant's SSN stays exactly as dtc-jobapp wrote it — already
      // encrypted by that site. It is not decrypted, re-encrypted, or moved
      // into a column of its own here. See the open decision in the brief
      // about at-rest encryption for sensitive fields in Postgres.
      return { id: a.id, ...promoted, data };
    }),
  );

  // metadata/setup and metadata/ingestion
  try {
    const meta = JSON.parse(await readFile(join(DOCS, "metadata.json"), "utf8"));
    const rows = Object.entries(meta)
      .filter(([, v]) => v)
      .map(([id, data]) => ({ id, data }));
    await upsert("app_metadata", rows);
  } catch {
    console.log("  app_metadata: nothing to import");
  }

  // ── storage ──────────────────────────────────────────────────────────────
  console.log("\nStorage:");
  let manifest = [];
  try {
    manifest = JSON.parse(await readFile(join(OUT, "storage-manifest.json"), "utf8"));
  } catch {
    console.log("  no storage manifest — run the export first");
  }

  let uploaded = 0;
  let failed = 0;
  for (const entry of manifest) {
    // Firebase kept one flat bucket with a folder prefix; Supabase uses a
    // bucket per prefix, so the first path segment selects the bucket and is
    // stripped from the object name.
    const slash = entry.path.indexOf("/");
    const bucket = slash === -1 ? null : entry.path.slice(0, slash);
    const objectPath = slash === -1 ? null : entry.path.slice(slash + 1);
    if (!["filed", "inbound", "courses"].includes(bucket)) {
      console.warn(`  ! unexpected path, skipped: ${entry.path}`);
      failed++;
      continue;
    }

    const body = await readFile(join(FILES, entry.path));
    const { error } = await sb.storage.from(bucket).upload(objectPath, body, {
      contentType: entry.contentType,
      upsert: true,
    });
    if (error) {
      console.warn(`  ! ${entry.path}: ${error.message}`);
      failed++;
    } else {
      uploaded++;
      if (uploaded % 25 === 0) console.log(`  ...${uploaded} uploaded`);
    }
  }
  console.log(`  ${uploaded} uploaded, ${failed} failed`);

  console.log("\nImport complete.");
  console.log("Every account needs a password reset — Firebase password hashes cannot transfer.");
  if (failed) console.log(`${failed} storage object(s) did not upload. Re-run to retry.`);
}

main().catch((err) => {
  console.error("\nImport failed:", err);
  process.exit(1);
});

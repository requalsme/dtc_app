// One-time export: pull everything out of Firebase before anything is removed.
//
// Read-only. Touches nothing in Firebase, writes only to migration/export/.
// Run this FIRST and keep its output — it is the source you diff against if an
// import goes wrong, and after the Firebase project is gone it is the only
// copy of the pre-migration state that still exists.
//
//   FIREBASE_SERVICE_ACCOUNT='<json or base64>' node migration/export-firebase.mjs
//
// Exports both halves of the problem:
//   * every document in every collection, verbatim, with its id
//   * every Storage object's BYTES, not just the metadata pointing at them.
//     The permanent getDownloadURL() tokens in pdfUrl fields die with the
//     project, so the files themselves have to move.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUT = join(process.cwd(), "migration", "export");
const DOCS_DIR = join(OUT, "firestore");
const FILES_DIR = join(OUT, "storage");

// Every collection named in the migration brief. `inbound` and
// metadata/ingestion may well be empty — that is worth recording as a fact
// rather than assuming, so they are exported like everything else.
const COLLECTIONS = [
  "users",
  "clients",
  "templates",
  "submissions",
  "documents",
  "audit",
  "tasks",
  "certificates",
  "courseHandoffs",
  "courseProgress",
  "inbound",
  "applications",
];

// Two junk CareTime test records that were deliberately excluded from the real
// client list and must stay excluded. They are still exported (so the export is
// a faithful snapshot of what Firestore held) but flagged here so the import
// can drop them without having to rediscover which ones they are.
const EXCLUDED_CLIENT_CARETIME_IDS = ["248760", "260924"];

function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT is not set.\n" +
        "Pull it from Netlify:  netlify env:get FIREBASE_SERVICE_ACCOUNT",
    );
    process.exit(1);
  }
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(text);
}

const app = initializeApp({
  credential: cert(readServiceAccount()),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "dtcapp-24504.firebasestorage.app",
});
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

// Firestore Timestamps and other SDK types do not survive JSON.stringify in any
// useful form, so they are converted to something the import can read back
// unambiguously. A Timestamp becomes its ISO string; anything else with a
// toJSON is left to it.
function plain(value) {
  if (value === null || value === undefined) return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") {
    // DocumentReference — record the path rather than silently emitting {}.
    if (typeof value.path === "string" && typeof value.id === "string") {
      return { __ref: value.path };
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = plain(v);
    return out;
  }
  return value;
}

async function exportCollection(name) {
  const snap = await db.collection(name).get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
  await writeFile(join(DOCS_DIR, `${name}.json`), JSON.stringify(docs, null, 2));

  let note = "";
  if (name === "clients") {
    const junk = docs.filter((d) =>
      EXCLUDED_CLIENT_CARETIME_IDS.includes(String(d.caretimeId ?? d.careTimeId ?? "")),
    );
    if (junk.length) note = `  (${junk.length} CareTime test record(s) present — import will drop them)`;
  }
  console.log(`  ${name}: ${docs.length} document(s)${note}`);
  return docs.length;
}

// metadata/ is two named documents rather than a collection of many, so it is
// exported by name — a collection read would work but would not record which
// documents were expected to exist.
async function exportMetadata() {
  const out = {};
  for (const id of ["setup", "ingestion"]) {
    const snap = await db.collection("metadata").doc(id).get();
    out[id] = snap.exists ? plain(snap.data()) : null;
    console.log(`  metadata/${id}: ${snap.exists ? "present" : "absent"}`);
  }
  await writeFile(join(DOCS_DIR, "metadata.json"), JSON.stringify(out, null, 2));
}

async function exportStorage() {
  // Storage may never have been provisioned. Projects created after ~Oct 2024
  // need the paid plan to use Cloud Storage at all, and billing on this project
  // is closed - so a missing bucket is an expected finding, not a failure. It
  // is reported rather than thrown, because the Firestore export beside it is
  // the part that actually carries the client records.
  const [bucketExists] = await bucket.exists();
  if (!bucketExists) {
    console.log("  no Storage bucket on this project - nothing to export.");
    console.log("  (Cloud Storage was never enabled here, so no file was ever stored.)");
    await writeFile(join(OUT, "storage-manifest.json"), "[]");
    return 0;
  }

  const [files] = await bucket.getFiles();
  const manifest = [];
  let bytes = 0;

  for (const file of files) {
    // Directory placeholder objects have no content and no meaning outside the
    // Firebase console's folder view.
    if (file.name.endsWith("/")) continue;

    const dest = join(FILES_DIR, file.name);
    await mkdir(dirname(dest), { recursive: true });
    const [contents] = await file.download();
    await writeFile(dest, contents);

    bytes += contents.length;
    manifest.push({
      path: file.name,
      contentType: file.metadata?.contentType || "application/octet-stream",
      size: Number(file.metadata?.size ?? contents.length),
      updated: file.metadata?.updated || null,
    });
    if (manifest.length % 25 === 0) console.log(`  ...${manifest.length} files`);
  }

  await writeFile(join(OUT, "storage-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`  ${manifest.length} file(s), ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  return manifest.length;
}

async function main() {
  await mkdir(DOCS_DIR, { recursive: true });
  await mkdir(FILES_DIR, { recursive: true });

  console.log("Firestore:");
  const counts = {};
  for (const name of COLLECTIONS) {
    try {
      counts[name] = await exportCollection(name);
    } catch (err) {
      // A collection that genuinely does not exist reads as empty rather than
      // throwing, so an error here is real and worth stopping for.
      console.error(`  ${name}: FAILED — ${err.message}`);
      throw err;
    }
  }
  await exportMetadata();

  console.log("\nStorage:");
  const fileCount = await exportStorage();

  await writeFile(
    join(OUT, "export-summary.json"),
    JSON.stringify(
      { exportedAt: new Date().toISOString(), collections: counts, storageFiles: fileCount },
      null,
      2,
    ),
  );

  console.log(`\nExport complete → migration/export/`);
  console.log("Keep this. After Firebase is removed it is the only copy of the old state.");
}

main().catch((err) => {
  console.error("\nExport failed:", err);
  process.exit(1);
});

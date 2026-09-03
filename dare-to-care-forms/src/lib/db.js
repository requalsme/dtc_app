// The small set of database operations the app actually performs, in Supabase
// terms. Everything above this file thinks in documents; everything below it is
// Postgres rows and RLS.
//
// Firestore's client SDK bundled querying, offline caching and realtime into
// one API. This deliberately replaces only the part the app used: fetch a
// collection, write a document, patch a document, delete one. Nothing here
// re-implements the parts that were never used.

import { supabase, BUCKETS } from "../config/supabase";
import { fromRow, toRow, primaryKey } from "./records.js";

/** Every row of a table the caller is allowed to see. */
export async function fetchAll(table) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return (data || []).map((row) => fromRow(table, row));
}

/**
 * Insert, letting the database generate the id.
 *
 * Firestore's addDoc() minted a random id client-side. Postgres text primary
 * keys have no default, so an id is generated here rather than making every
 * table carry a uuid default that only exists for this one call pattern.
 */
export async function insert(table, obj) {
  const id = obj.id || crypto.randomUUID();
  const row = { [primaryKey(table)]: id, ...toRow(table, obj) };
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return fromRow(table, data);
}

/** Insert or replace at a caller-chosen id — the setDoc() equivalent. */
export async function put(table, id, obj) {
  const row = { [primaryKey(table)]: id, ...toRow(table, obj) };
  const { data, error } = await supabase.from(table).upsert(row).select().single();
  if (error) throw error;
  return fromRow(table, data);
}

/**
 * Patch a document: touch the named fields and leave everything else alone.
 *
 * Promoted columns are updated directly. Fields that live inside the `data`
 * jsonb need a merge, and supabase-js cannot express `data = data || patch` in
 * an update, so those are read-modify-written.
 *
 * The race window that opens is real but narrow, and it is the same one the
 * Firestore version had for its own read-then-write paths. This app has a
 * handful of office staff editing largely disjoint records; two people patching
 * different jsonb fields of the SAME document within the same few hundred
 * milliseconds is the only way to lose a write. If that ever stops being true,
 * the fix is a `data = data || $1::jsonb` RPC, not more locking here.
 */
export async function update(table, id, patch) {
  const pk = primaryKey(table);
  const row = toRow(table, patch, { partial: true });
  const dataPatch = row.__dataPatch;
  delete row.__dataPatch;

  if (dataPatch) {
    const { data: current, error: readErr } = await supabase
      .from(table)
      .select("data")
      .eq(pk, id)
      .single();
    if (readErr) throw readErr;
    row.data = { ...(current?.data || {}), ...dataPatch };
  }

  if (!Object.keys(row).length) return { id };

  const { data, error } = await supabase.from(table).update(row).eq(pk, id).select().single();
  if (error) throw error;
  return fromRow(table, data);
}

/**
 * Append an item to an array that lives inside the `data` jsonb — the
 * arrayUnion() equivalent, used for correctionHistory.
 *
 * Firestore's arrayUnion was atomic and also de-duplicated. This is neither:
 * correction history is an append-only log where two identical entries are
 * meaningfully different events (the same note sent twice), so de-duplicating
 * would actually lose information.
 */
export async function appendToArray(table, id, field, item) {
  const pk = primaryKey(table);
  const { data: current, error: readErr } = await supabase
    .from(table)
    .select("data")
    .eq(pk, id)
    .single();
  if (readErr) throw readErr;

  const existing = Array.isArray(current?.data?.[field]) ? current.data[field] : [];
  const merged = { ...(current?.data || {}), [field]: [...existing, item] };

  const { error } = await supabase.from(table).update({ data: merged }).eq(pk, id);
  if (error) throw error;
}

export async function remove(table, id) {
  const { error } = await supabase.from(table).delete().eq(primaryKey(table), id);
  if (error) throw error;
}

// ── Storage ────────────────────────────────────────────────────────────────

/**
 * Upload and return the object's path — NOT a URL.
 *
 * This is the deliberate difference from the Firebase version, which called
 * getDownloadURL() and stored a permanent bearer-token URL in the record.
 * Anyone who ever saw that URL kept access forever, including after being
 * offboarded, and revoking it meant rewriting every record that held one. Here
 * the record stores a path, and a URL is minted per view (see signedUrl) so
 * access is re-decided against the storage policies every time.
 */
export async function uploadFile(bucket, path, body, contentType) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** A short-lived URL for one object. */
export async function signedUrl(bucket, path, expiresIn = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl || null;
}

/**
 * Signed URLs for many objects at once.
 *
 * Called after every refresh to attach viewable links to the records currently
 * in memory. One request for the whole page beats one per row, and the URLs
 * live only in memory for the session — nothing is written back to the
 * database, so there is still no permanent token at rest anywhere.
 */
export async function signedUrls(bucket, paths, expiresIn = 3600) {
  const wanted = [...new Set(paths.filter(Boolean))];
  if (!wanted.length) return {};

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(wanted, expiresIn);
  if (error) return {};

  const out = {};
  for (const entry of data || []) {
    // An object the caller may not read comes back with an error rather than
    // failing the whole batch, which is exactly the behaviour wanted: one
    // inaccessible file must not blank out the rest of someone's screen.
    if (entry.signedUrl && !entry.error) out[entry.path] = entry.signedUrl;
  }
  return out;
}

export { BUCKETS };

// Server-side half of the document <-> row translation.
//
// The tables promote to real columns only the fields that RLS policies, foreign
// keys and queries need, and keep the rest of the document in `data` jsonb (see
// supabase/schema.sql). Anything writing to those tables has to respect that
// split, including these functions.
//
// This deliberately mirrors dare-to-care-forms/src/lib/records.js rather than
// importing it. The frontend is bundled by Vite and these functions by esbuild
// from a different root, so a shared module would mean either a build-time path
// hack or publishing an internal package — more machinery than a small mirrored
// map is worth. It covers only the three tables the server actually writes; if
// that grows, the two files are the pair to keep in step.

const FIELDS = {
  submissions: {
    caregiver_id: "caregiverId",
    caregiver_name: "caregiverName",
    client_id: "clientId",
    client_name: "clientName",
    schema_key: "schemaKey",
    template_name: "templateName",
    status: "status",
    submitted_at: "submittedAt",
    subject_type: "subjectType",
    subject_id: "subjectId",
    pdf_path: "pdfPath",
    pdf_pending: "pdfPending",
    pdf_filed_at: "pdfFiledAt",
    deleted_at: "deletedAt",
    deleted_by: "deletedBy",
    deleted_by_id: "deletedById",
    delete_reason: "deleteReason",
  },
  audit: {
    action: "action",
    target: "target",
    detail: "detail",
    actor: "actor",
    role: "role",
    timestamp: "timestamp",
  },
  inbound: {
    status: "status",
    created_at: "createdAt",
  },
};

/** Postgres row -> the flat object the rest of the code works with. */
export function fromRow(table, row) {
  if (!row) return row;
  const map = FIELDS[table] || {};
  const out = { ...(row.data || {}) };
  for (const [column, field] of Object.entries(map)) {
    if (row[column] !== null && row[column] !== undefined) out[field] = row[column];
  }
  out.id = row.id;
  return out;
}

/**
 * A document -> a row.
 *
 * Promoted keys are removed from `data` so there is exactly one copy of each.
 * A jsonb shadow of `status` or `caregiver_id` that drifted out of step with
 * its column would mean silently wrong permissions.
 */
export function toRow(table, obj) {
  const map = FIELDS[table] || {};
  const rest = { ...obj };
  const row = {};
  delete rest.id;
  for (const [column, field] of Object.entries(map)) {
    if (field in rest) {
      row[column] = rest[field];
      delete rest[field];
    }
  }
  row.data = rest;
  return row;
}

/**
 * Patch a document's jsonb without discarding the rest of it.
 *
 * Read-modify-write, because supabase-js cannot express `data = data || patch`
 * in an update. These are reviewer-driven actions on one queue entry at a time,
 * so two writers racing on the same row would mean two people resolving the
 * same document in the same instant — and the status guard in resolve.mjs
 * already rejects the second one.
 */
export async function patchRow(sb, table, id, patch) {
  const map = FIELDS[table] || {};
  const promotedFields = new Set(Object.values(map));
  const row = {};
  const dataPatch = {};

  for (const [key, value] of Object.entries(patch)) {
    if (promotedFields.has(key)) {
      const column = Object.keys(map).find((c) => map[c] === key);
      row[column] = value;
    } else {
      dataPatch[key] = value;
    }
  }

  if (Object.keys(dataPatch).length) {
    const { data: current, error } = await sb.from(table).select("data").eq("id", id).single();
    if (error) throw error;
    row.data = { ...(current?.data || {}), ...dataPatch };
  }

  const { error } = await sb.from(table).update(row).eq("id", id);
  if (error) throw error;
}

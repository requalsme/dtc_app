// Translation between the app's document-shaped objects and the Postgres rows
// behind them.
//
// WHY THIS EXISTS
// Firestore documents had no fixed schema and several collections genuinely
// depend on that — a template carries an arbitrary nested `sections` array, a
// submission carries whatever answers its form asked for. The Postgres tables
// therefore promote to real columns only the fields that RLS policies, foreign
// keys and queries need, and keep the rest of the document verbatim in a `data`
// jsonb column (see supabase/schema.sql).
//
// That split has to happen in exactly one place or it will eventually be done
// two slightly different ways. This is that place, and migration/
// import-supabase.mjs uses the same field names so the imported rows and the
// rows the running app writes are identical in shape.
//
// The invariant: a promoted key is REMOVED from `data` on the way down. There is
// never a jsonb copy of `status` or `caregiver_id` shadowing the column an RLS
// policy actually reads — a shadow that drifts out of step would mean silently
// wrong permissions, which is the worst way to be wrong.

/**
 * column name -> app field name.
 * Anything not listed lives in `data` untouched.
 */
const FIELDS = {
  users: {
    name: "name",
    email: "email",
    role: "role",
    dev_access: "devAccess",
    status: "status",
    must_change_password: "mustChangePassword",
    courses_unlocked_at: "coursesUnlockedAt",
    created_at: "createdAt",
    last_login_at: "lastLoginAt",
  },
  clients: {
    name: "name",
    status: "status",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  templates: {
    name: "name",
    status: "status",
    version: "version",
    updated_at: "updatedAt",
  },
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
  documents: {
    subject_type: "subjectType",
    subject_id: "subjectId",
    checklist_item_id: "checklistItemId",
    file_name: "fileName",
    content_type: "contentType",
    size: "size",
    storage_path: "path",
    document_date: "documentDate",
    note: "note",
    uploaded_by: "uploadedBy",
    uploaded_by_id: "uploadedById",
    uploaded_at: "uploadedAt",
    source: "source",
  },
  tasks: {
    status: "status",
    due_date: "dueDate",
    created_at: "createdAt",
  },
  audit: {
    action: "action",
    target: "target",
    detail: "detail",
    actor: "actor",
    role: "role",
    timestamp: "timestamp",
  },
  certificates: {
    user_id: "linkedUserId",
    source: "source",
    passed: "passed",
    date: "date",
  },
  course_handoffs: {
    uid: "uid",
    created_at: "createdAt",
  },
  course_progress: {
    updated_at: "updatedAt",
  },
  inbound: {
    status: "status",
    created_at: "createdAt",
  },
  applications: {
    status: "status",
    reviewed_at: "reviewedAt",
    reviewed_by: "reviewedBy",
    review_note: "reviewNote",
    created_at: "createdAt",
  },
  courses: {
    title: "title",
    description: "description",
    video_path: "videoPath",
    sort_order: "sortOrder",
  },
  app_metadata: {},
};

/** Tables whose primary key column isn't called `id`. */
const PRIMARY_KEY = {
  course_handoffs: "token",
  course_progress: "key",
};

export function primaryKey(table) {
  return PRIMARY_KEY[table] || "id";
}

/** Postgres row -> the flat object the app has always worked with. */
export function fromRow(table, row) {
  if (!row) return row;
  const map = FIELDS[table] || {};
  const out = { ...(row.data || {}) };

  for (const [column, field] of Object.entries(map)) {
    // A column that is null because the document never had that field should
    // not materialise as an explicit null the UI then has to special-case.
    if (row[column] !== null && row[column] !== undefined) out[field] = row[column];
  }

  out.id = row[primaryKey(table)];
  return out;
}

/**
 * The app's object -> a row.
 *
 * `partial` is for patch-style updates: only the keys actually present are
 * returned, so an update touches exactly the columns the caller named. Without
 * it a patch would null out every column it failed to mention.
 */
export function toRow(table, obj, { partial = false } = {}) {
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

  if (partial) {
    // Merge rather than replace: a patch that mentions one jsonb field must not
    // discard the rest of the document. Callers that need the whole `data`
    // replaced pass partial: false.
    if (Object.keys(rest).length) row.__dataPatch = rest;
  } else {
    row.data = rest;
  }
  return row;
}

/**
 * Dates arrive from Postgres as ISO strings already, which is what the app has
 * always stored, so reads need no conversion. Writes are the other direction:
 * a `timestamptz` column rejects "" but accepts null, and the app uses "" in a
 * few places where a value is simply absent.
 */
export function emptyToNull(value) {
  return value === "" ? null : value;
}

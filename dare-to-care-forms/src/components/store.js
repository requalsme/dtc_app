import { collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, arrayUnion } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage, firebaseConfig } from "../config/firebase";
// Static: FormWizard already imports this, so a dynamic import here would not
// split it into its own chunk. The heavy libraries (jspdf, html2canvas) are
// dynamically imported inside utils/pdf itself, which is where the win actually is.
// @ts-ignore
import { elementToPdfBlob } from "../utils/pdf";
// What a complete file has to contain, for a caregiver and for a client.
// Kept as data next door rather than logic in here, because the checklist
// changes on a different (and much faster) schedule than this code does.
import { checklistFor, checklistItems } from "./file-checklist";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

const secondaryApp = getApps().find(a => a.name === "Secondary") ? getApp("Secondary") : initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);
import { DTC } from "./schemas.js";

const listeners = new Set();

// ─── Offline queue ─────────────────────────────────────────────────────────
const QUEUE_KEY = "dtc_offline_queue";

function getQueuedSubmissions() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}



function addToQueue(item) {
  const queue = getQueuedSubmissions();
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const entry = { ...item, id: localId, __localId: localId, queuedAt: new Date().toISOString() };
  queue.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  emit();
  return entry;
}

function removeFromQueue(id) {
  const queue = getQueuedSubmissions().filter((item) => item.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  emit();
}

async function syncQueue() {
  const queue = getQueuedSubmissions();
  if (queue.length === 0) return;
  let synced = 0;
  for (const item of queue) {
    try {
      // Strip only local bookkeeping fields; keep status/templateName/caregiver so the
      // synced record is identical to an online submission.
      const { id: _id, __localId: _lid, queuedAt: _q, ...payload } = item;
      await addDoc(collection(db, "submissions"), payload);
      removeFromQueue(item.id);
      synced++;
    } catch { /* still offline or server error — leave in queue */ }
  }
  if (synced > 0) await refresh();
}

// ─── Ingestion endpoints ───────────────────────────────────────────────────
// The review queue's two actions run server-side, on Netlify functions rather
// than Firebase Cloud Functions — Cloud Functions need the paid Blaze plan for
// what amounts to one cron job and two form posts.
//
// That means no callable SDK, so identity travels as a Firebase ID token in the
// Authorization header and the function verifies it. Same-origin, because the
// app and the functions are served from the same Netlify site.
async function callIngestion(endpoint, payload) {
  const user = auth.currentUser;
  if (!user) throw new Error("You are signed out. Sign in again.");

  // Not cached: a stale token is the most common cause of a spurious 401, and
  // the SDK only refreshes on its own schedule.
  const token = await user.getIdToken();

  const res = await fetch(`/.netlify/functions/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The function always returns { error } on failure, so the reviewer sees
    // what actually went wrong rather than a status code.
    throw new Error(body.error || `That didn't work (${res.status}).`);
  }
  return body;
}

// ─── Audit trail (best-effort; never blocks the user action) ────────────────
async function logAudit(action, target, detail) {
  try {
    await addDoc(collection(db, "audit"), {
      action,
      target: target != null ? String(target) : "",
      detail: detail != null ? String(detail) : "",
      actor: state.user?.name || auth.currentUser?.email || "system",
      role: state.user?.role || "unknown",
      timestamp: new Date().toISOString(),
    });
  } catch { /* audit is best-effort */ }
}

const ROLE_LABELS_MAP = { admin: "Administrator", caregiver: "Caregiver", officeManager: "Office Manager", newHire: "New Hire", client: "Client" };
function ROLE_LABEL(r) { return ROLE_LABELS_MAP[r] || r || ""; }

// Legacy templates were stored with the schema nested under `schema` and no
// top-level `sections`, which crashes the builder. Normalize them on load so
// every consumer sees a flat template with `sections`.
function normalizeTemplate(t) {
  if (!t) return t;
  if (Array.isArray(t.sections)) return t;
  if (t.schema && Array.isArray(t.schema.sections)) {
    const merged = { ...t.schema, ...t, sections: t.schema.sections };
    merged.fieldCount = t.fieldCount ?? t.schema.sections.reduce((n, s) => n + ((s.fields || []).length), 0);
    return merged;
  }
  return { ...t, sections: [] };
}

// Every form an admin can import and publish. A schema that is missing from
// this list exists in code but is unreachable from the UI, so anything added to
// DTC.schemas must be added here too.
//
// `file` names the source PDF the schema was transcribed from, so a form can
// always be traced back to the paper document it has to match.
// Advance a due date by one recurrence interval. Counted from the date the task
// was DUE, not the date it was completed, so a visit done late doesn't quietly
// push the whole schedule later and drift out of compliance.
function nextDueDate(fromISO, recurrence) {
  if (!fromISO || !recurrence) return null;
  const d = new Date(fromISO + (fromISO.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return null;

  switch (recurrence) {
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setDate(d.getDate() + 90); break;   // 90 days, per the Care Plan
    case "semiannual": d.setMonth(d.getMonth() + 6); break;
    case "annual": d.setFullYear(d.getFullYear() + 1); break;
    default: return null;
  }

  // If the task was completed so late that the next date is already in the
  // past, roll forward to the next future occurrence rather than creating a
  // task that is born overdue.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let guard = 0;
  while (d < today && guard < 60) {
    switch (recurrence) {
      case "monthly": d.setMonth(d.getMonth() + 1); break;
      case "quarterly": d.setDate(d.getDate() + 90); break;
      case "semiannual": d.setMonth(d.getMonth() + 6); break;
      case "annual": d.setFullYear(d.getFullYear() + 1); break;
      default: return null;
    }
    guard++;
  }
  return d.toISOString().slice(0, 10);
}

const referenceLibrary = [
  // ── Standalone forms ─────────────────────────────────────────────────────
  { id: "lib_fallRisk", file: "Fall_Risk_Assessment.pdf", pages: 1, schemaKey: "fallRisk" },
  { id: "lib_medList", file: "Medication_List.pdf", pages: 1, schemaKey: "medicationList" },
  { id: "lib_wpv", file: "Workplace_Violence_Policy_Acknowledgement.pdf", pages: 1, schemaKey: "workplaceViolence" },
  { id: "lib_activity", file: "CaregiverActivityReport.pdf", pages: 1, schemaKey: "caregiverActivity" },
  { id: "lib_super", file: "Supervisory_Visit_Form.pdf", pages: 1, schemaKey: "supervisoryVisit" },
  { id: "lib_ccpr", file: "Client_Care_Plan_Review.pdf", pages: 1, schemaKey: "clientCarePlanReview" },
  { id: "lib_epp", file: "Emergency_Preparedness_Plan.pdf", pages: 1, schemaKey: "emergencyPreparedness" },
  { id: "lib_carePlan", file: "Client Admission Packet.pdf (p.15-16)", pages: 2, schemaKey: "clientCarePlan" },

  // ── New Hire Packet (30pp, 2026-07-27) ───────────────────────────────────
  { id: "lib_jd_home", file: "New Hire Packet.pdf (p.5)", pages: 1, schemaKey: "homemakerJobDescription" },
  { id: "lib_jd_pcw", file: "New Hire Packet.pdf (p.6)", pages: 1, schemaKey: "pcwJobDescription" },
  { id: "lib_jd_ihss", file: "New Hire Packet.pdf (p.7-8)", pages: 2, schemaKey: "ihssAttendantJobDescription" },
  { id: "lib_orient", file: "New Hire Packet.pdf (p.9-10)", pages: 2, schemaKey: "orientationChecklist" },
  { id: "lib_avail", file: "New Hire Packet.pdf (p.10-11)", pages: 2, schemaKey: "caregiverAvailability" },
  { id: "lib_rules", file: "New Hire Packet.pdf (p.12-13)", pages: 2, schemaKey: "rulesOfTheRoad" },
  { id: "lib_handbook", file: "New Hire Packet.pdf (p.13-14)", pages: 2, schemaKey: "employeeHandbookAck" },
  { id: "lib_policies", file: "New Hire Packet.pdf (p.14-15)", pages: 2, schemaKey: "policiesReceipt" },
  { id: "lib_scope", file: "New Hire Packet.pdf (p.16-18)", pages: 3, schemaKey: "careScopeAndTasks" },
  { id: "lib_missed", file: "New Hire Packet.pdf (p.22)", pages: 1, schemaKey: "missedVisitsPolicy" },
  { id: "lib_flu", file: "New Hire Packet.pdf (p.23)", pages: 1, schemaKey: "fluVaccineStatement" },
  { id: "lib_comp", file: "New Hire Packet.pdf (p.27-29)", pages: 3, schemaKey: "competencyValidation" },

  // ── Client Admission Packet (29pp, 2026-07-27) ───────────────────────────
  { id: "lib_welcome", file: "Client Admission Packet.pdf (p.4)", pages: 1, schemaKey: "welcomeLetter" },
  { id: "lib_agreement", file: "Client Admission Packet.pdf (p.5-8)", pages: 4, schemaKey: "homeCareServicesAgreement" },
  { id: "lib_assess", file: "Client Admission Packet.pdf (p.9-13)", pages: 5, schemaKey: "clientAssessment" },
  { id: "lib_rights", file: "Client Admission Packet.pdf (p.17)", pages: 1, schemaKey: "consumerRights" },
  { id: "lib_disclosure", file: "Client Admission Packet.pdf (p.18)", pages: 1, schemaKey: "agencyDisclosure" },
  { id: "lib_conf", file: "Client Admission Packet.pdf (p.20)", pages: 1, schemaKey: "consumerConfidentiality" },
  { id: "lib_hipaa", file: "Client Admission Packet.pdf (p.21-23)", pages: 3, schemaKey: "privacyPracticesNotice" },
  { id: "lib_advdir", file: "Client Admission Packet.pdf (p.25)", pages: 1, schemaKey: "advanceDirectivesNotice" },
  { id: "lib_billing", file: "Client Admission Packet.pdf (p.26)", pages: 1, schemaKey: "financialBillingNotice" },
  { id: "lib_eppclient", file: "Client Admission Packet.pdf (p.27-28)", pages: 2, schemaKey: "eppClientInfo" },

  // ── Client portal ────────────────────────────────────────────────────────
  { id: "lib_cec", file: "Emergency_Contacts.pdf", pages: 1, schemaKey: "clientEmergencyContacts" },
  { id: "lib_ccp", file: "Care_Preferences.pdf", pages: 1, schemaKey: "clientCarePreferences" },
  { id: "lib_csat", file: "Satisfaction_Survey.pdf", pages: 1, schemaKey: "clientSatisfaction" },

  // ── HCA Annual Agency Evaluation packet (19pp, uploaded 2026-08-09) ──────
  { id: "lib_hcaAnnual", file: "HCA_Annual_Agency_Evaluation_FILLABLE.pdf (p.1-18)", pages: 18, schemaKey: "hcaAnnualEvaluation" },
  { id: "lib_hcaRecordAudit", file: "HCA_Annual_Agency_Evaluation_FILLABLE.pdf (p.16-17)", pages: 2, schemaKey: "consumerRecordAudit" },
  { id: "lib_hcaProgramTool", file: "HCA_Annual_Agency_Evaluation_FILLABLE.pdf (p.17-18)", pages: 2, schemaKey: "hcaProgramEvaluationTool" },
];

const state = {
  templates: [],
  clients: [],
  submissions: [],
  audit: [],
  users: [],
  tasks: [],
  certificates: [],
  // Scans and photos attached to a person — licences, I-9s, background check
  // results, packets signed on paper. The counterpart to `submissions`, which
  // are the documents the app generated itself.
  documents: [],
  // Documents that arrived from outside the app and have not been filed yet.
  // Only office managers and admins can read these, so for everyone else this
  // stays empty — see the `inbound` rule in firestore.rules.
  inbound: [],
  // Employment applications submitted on careers.daretocarehomecare.com
  // (dtc-jobapp — a separate site, same Firebase project). Office-manager+
  // only, same reasoning as inbound — see the `applications` rule in
  // firestore.rules.
  applications: [],
  user: null, // Track current user manually from AuthContext if needed
};

function emit() {
  listeners.forEach((listener) => {
    try { listener(); } catch { /* ignore */ }
  });
}

function clearState() {
  state.templates = [];
  state.clients = [];
  state.submissions = [];
  state.audit = [];
  state.users = [];
  state.tasks = [];
  state.certificates = [];
  state.documents = [];
  state.inbound = [];
  state.applications = [];
  emit();
}

async function fetchCollection(colName) {
  const snap = await getDocs(collection(db, colName));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function refresh() {
  const user = auth.currentUser;
  if (!user) { clearState(); return; }

  try {
    const requests = [
      fetchCollection("templates"),
      fetchCollection("clients"),
      fetchCollection("submissions"),
      fetchCollection("tasks"),
    ];

    // TODO: Need proper user role tracking to restrict this, fetching all for now.
    // In a real app with Firestore Rules, this would be restricted automatically.
    requests.push(fetchCollection("audit"));
    requests.push(fetchCollection("users"));
    // Certificates are written by the course site; collection may be empty/absent.
    requests.push(fetchCollection("certificates").catch(() => []));
    // The ingestion queue is office-manager-and-above. For a caregiver this
    // read is denied by the rules, which is the intended answer — swallow it so
    // one restricted collection doesn't fail their whole refresh.
    requests.push(fetchCollection("inbound").catch(() => []));
    // Uploaded scans. Swallowed the same way — a caregiver who can't read the
    // whole collection shouldn't have their entire refresh fail because of it.
    requests.push(fetchCollection("documents").catch(() => []));
    // Employment applications — office-manager+ only, swallowed the same way.
    requests.push(fetchCollection("applications").catch(() => []));

    const [templates, clients, submissions, tasks, audit, users, certificates, inbound, documents, applications] = await Promise.all(requests);
    state.templates = (templates || []).map(normalizeTemplate);
    state.clients = clients;
    state.submissions = submissions;
    state.tasks = tasks;
    state.audit = audit;
    state.users = users;
    state.certificates = certificates || [];
    state.inbound = inbound || [];
    state.documents = documents || [];
    state.applications = applications || [];

    // Find current user profile
    state.user = users.find(u => u.id === user.uid) || null;
    emit();
  } catch (error) {
    console.error("Refresh failed", error);
    throw error;
  }
}

// In Firebase, we rely on Auth state changes rather than custom events for the most part.
// But we keep this listener alive for backward compatibility with frontend.
window.addEventListener("dtc-auth-changed", () => { void refresh(); });
window.addEventListener("online", () => { void syncQueue().then(() => refresh()); });
auth.onAuthStateChanged((user) => {
  if (user) void refresh();
  else clearState();
});

// Admin "preview as role" (see AuthContext.enterPreview) renders real
// caregiver/officeManager/newHire/client screens so an admin can see exactly
// what that role sees. The screens themselves have no idea they're being
// previewed — they call the same Store write methods a real user would. This
// flag is the actual safety boundary: every write method below calls
// assertWritable() first, so "preview mode won't affect real data" (the copy
// shown in the UI) is true because the write never reaches Firestore, not
// just because nobody happened to click a button. Toggled by
// AuthContext.enterPreview/exitPreview — never set from anywhere a real
// logged-in-as-that-role user's actions run through.
let previewMode = false;
function assertWritable() {
  if (previewMode) {
    throw new Error("Preview mode — no changes were made. Exit preview to make real changes.");
  }
}

export const DTCStore = {
  setPreviewMode(on) { previewMode = on; },
  get isPreviewMode() { return previewMode; },

  subscribe(listener) {
    listeners.add(listener);
    try { listener(); } catch { /* ignore */ }
    return () => listeners.delete(listener);
  },

  get currentUser() { return state.user; },
  get clients() { return state.clients; },
  get users() { return state.users.slice(); },

  async refresh() { await refresh(); },
  reset() { clearState(); },

  getLibrary() {
    return referenceLibrary.map((item) => {
      const schema = DTC.schemas[item.schemaKey] || {};
      return {
        ...item,
        // Carried through so the library can lead with the form's name and
        // group by category — with 33 entries, a flat list keyed on filename
        // is unreadable.
        name: schema.name || item.schemaKey,
        category: schema.category || "Other",
        description: schema.description || "",
        imported: state.templates.some((t) => t.key === item.schemaKey),
      };
    });
  },

  schemaName(schemaKey) {
    return state.templates.find((t) => t.key === schemaKey)?.name || DTC.schemas[schemaKey]?.name || schemaKey;
  },

  getTemplates() { return state.templates.slice(); },
  getPublishedTemplates() { return state.templates.filter((t) => t.status === "published"); },
  getTemplate(key) { return state.templates.find((t) => t.key === key) || null; },

  publishedKeysFor(role) {
    return state.templates
      .filter((t) => t.status === "published" && (!t.completedBy || t.completedBy.includes(role)))
      .map((t) => t.key);
  },

  async importTemplate(schemaKey) {
    // Spread the full schema onto the stored template so top-level fields the UI
    // reads (sections, category, version, icon, description, subject, completedBy)
    // actually exist. Previously the schema was nested under `schema`, which left
    // `template.sections` undefined and crashed the Builder.
    const base = DTC.schemas[schemaKey] || {};
    const fieldCount = (base.sections || []).reduce((n, s) => n + (s.fields || []).length, 0);
    const template = {
      ...base,
      key: schemaKey,
      status: "draft",
      version: base.version || 1,
      fieldCount,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "templates", schemaKey), template);
    await logAudit("template_imported", base.name || schemaKey);
    await refresh();
    return template;
  },

  // Real, arbitrary-PDF import: unlike importTemplate (which clones one of the
  // fixed reference-library schemas), this accepts a schema built at runtime by
  // src/utils/pdfExtract.ts from whatever PDF the admin actually uploaded.
  async importUploadedSchema(schema) {
    const key = state.templates.some((t) => t.key === schema.key)
      ? `${schema.key}_${Date.now().toString(36)}`
      : schema.key;
    const fieldCount = (schema.sections || []).reduce((n, s) => n + (s.fields || []).length, 0);
    const template = {
      ...schema,
      key,
      status: "draft",
      version: schema.version || 1,
      fieldCount,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "templates", key), template);
    await logAudit("template_imported", schema.name || key, `Uploaded from ${schema.sourceFile || "PDF"}`);
    await refresh();
    return template;
  },

  async saveTemplate(template) {
    const fieldCount = (template.sections || []).reduce((n, s) => n + (s.fields || []).length, 0);
    const toSave = { ...template, fieldCount, updatedAt: new Date().toISOString() };
    await setDoc(doc(db, "templates", template.key), toSave);
    await logAudit("template_saved", template.name || template.key);
    await refresh();
    return toSave;
  },

  async publishTemplate(key) {
    await updateDoc(doc(db, "templates", key), { status: "published", updatedAt: new Date().toISOString() });
    await logAudit("template_published", this.schemaName(key));
    await refresh();
    return { key, status: "published" };
  },

  async unpublishTemplate(key) {
    await updateDoc(doc(db, "templates", key), { status: "draft", updatedAt: new Date().toISOString() });
    await logAudit("template_unpublished", this.schemaName(key));
    await refresh();
    return { key, status: "draft" };
  },

  async getTemplateVersions() {
    // Requires subcollection or complex logic in Firestore. Returning empty for now.
    return [];
  },

  // Submissions
  getSubmissions() { return state.submissions.slice(); },
  getQueuedSubmissions,

  async addSubmission(submission) {
    assertWritable();
    // Stamp the record with everything the review workflow depends on. These were
    // missing before, which broke the caregiver Records tab and office review queue.
    const me = state.user;
    const enriched = {
      ...submission,
      status: "submitted",
      submittedAt: submission.submittedAt || new Date().toISOString(),
      caregiverId: submission.caregiverId ?? me?.id ?? null,
      caregiverName: submission.caregiverName ?? me?.name ?? null,
      templateName: submission.templateName ?? DTC.schemas[submission.schemaKey]?.name ?? submission.schemaKey,
      correctionHistory: [],
    };
    // Offline-safe: queue locally if the network is down or the write fails.
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (offline) {
      const entry = addToQueue(enriched);
      return { ...entry, queued: true };
    }
    try {
      const docRef = await addDoc(collection(db, "submissions"), enriched);
      await logAudit("form_submitted", enriched.templateName, enriched.clientName || "");
      await refresh();
      return { id: docRef.id, ...enriched };
    } catch (err) {
      const entry = addToQueue(enriched);
      return { ...entry, queued: true };
    }
  },

  removeFromQueue,
  async syncQueue() { await syncQueue(); },

  // ─── Filing ──────────────────────────────────────────────────────────────
  // Every completed form is filed as a PDF against the person it belongs to,
  // so records live under a client's or staff member's name the way a paper
  // folder would — rather than only existing if someone clicks "download".

  // A form is filed under the client it is about; forms with no client (new-hire
  // paperwork, policy acknowledgements) are filed under the staff member who
  // signed them.
  subjectForSubmission(sub) {
    if (!sub) return null;
    if (sub.clientId) {
      return { type: "client", id: sub.clientId, name: sub.clientName || "Client" };
    }
    if (sub.caregiverId) {
      return { type: "staff", id: sub.caregiverId, name: sub.caregiverName || "Staff" };
    }
    return null;
  },

  // All filed records for one person, newest first.
  submissionsForSubject(type, id) {
    if (!id) return [];
    const key = type === "client" ? "clientId" : "caregiverId";
    return state.submissions
      .filter((s) => s[key] === id)
      // Soft-deleted records stay in the database (see softDeleteSubmission)
      // but drop out of every ordinary view. Only the dev portal's deleted-
      // items screen reads getDeletedSubmissions() directly.
      .filter((s) => !s.deletedAt)
      // A client-subject form belongs to the client, not to the caregiver who
      // filled it in — so it must not also appear in that caregiver's own file.
      .filter((s) => (type === "staff" ? !s.clientId : true))
      .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
  },

  // Renders the on-screen document, uploads it, and links it to the record.
  // Never throws: a storage failure must not lose an already-saved submission,
  // so it degrades to pdfPending and can be regenerated later.
  async fileSubmissionPdf(saved, sheetEl) {
    if (!saved?.id || saved.queued || !sheetEl) {
      if (saved?.id && !saved.queued) {
        try { await updateDoc(doc(db, "submissions", saved.id), { pdfPending: true }); } catch { /* non-fatal */ }
      }
      return null;
    }
    const subject = DTCStore.subjectForSubmission(saved);
    if (!subject) return null;
    try {
      const blob = await elementToPdfBlob(sheetEl);
      // Filed documents are immutable. A corrected resubmission is filed as a new
      // version alongside the original rather than overwriting it, so there is
      // always a record of exactly what was signed and when.
      const path = `filed/${subject.type}/${subject.id}/${saved.id}__${Date.now()}.pdf`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, blob, { contentType: "application/pdf" });
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, "submissions", saved.id), {
        pdfUrl: url,
        pdfPath: path,
        pdfFiledAt: new Date().toISOString(),
        pdfPending: false,
        subjectType: subject.type,
        subjectId: subject.id,
      });
      await logAudit("form_filed", saved.templateName || saved.schemaKey, subject.name);
      await refresh();
      return url;
    } catch {
      // Keep the record; flag that its PDF still needs generating.
      try { await updateDoc(doc(db, "submissions", saved.id), { pdfPending: true }); } catch { /* non-fatal */ }
      return null;
    }
  },

  // ---------------------------------------------------------------------
  // Scanned documents
  // ---------------------------------------------------------------------
  // The other half of the filing cabinet. `fileSubmissionPdf` above files
  // documents the app GENERATED; this files documents the app RECEIVED — a
  // driver's licence photographed on a phone, a CBI result that arrived as a
  // PDF, a packet signed on paper before anyone had an app account.
  //
  // Both land in the same place under the same person, so a complete file
  // reads the same whether it was built digitally or out of a paper folder.
  async uploadDocument(subjectType, subjectId, checklistItemId, file, meta = {}) {
    assertWritable();
    if (!file) throw new Error("No file chosen");
    if (!["client", "staff"].includes(subjectType)) throw new Error("Unknown file type");
    // 25MB matches the storage rules. A phone photo of a licence is ~3MB, so
    // anything past this is almost certainly a mistake worth catching early.
    if (file.size > 25 * 1024 * 1024) throw new Error("File is too large (25MB limit)");

    const safe = String(file.name || "document").replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `filed/${subjectType}/${subjectId}/uploads/${Date.now()}__${safe}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type || "application/octet-stream" });
    const url = await getDownloadURL(fileRef);

    const record = {
      subjectType,
      subjectId,
      checklistItemId: checklistItemId || null,
      fileName: file.name || safe,
      contentType: file.type || "",
      size: file.size,
      url,
      path,
      // The date on the DOCUMENT, not the date it was scanned. A background
      // check run in March that gets uploaded in August is still a March
      // check — and for anything that expires annually, using the upload
      // date instead would quietly grant an extra five months of validity.
      documentDate: meta.documentDate || null,
      note: meta.note || "",
      uploadedBy: state.user?.name || "Office",
      uploadedById: state.user?.id || null,
      uploadedAt: new Date().toISOString(),
      source: meta.source || "manual-upload",
    };
    const created = await addDoc(collection(db, "documents"), record);
    await logAudit("document_uploaded", record.fileName, subjectId);
    await refresh();
    return { id: created.id, ...record };
  },

  getDocuments() { return (state.documents || []).slice(); },

  documentsForSubject(type, id) {
    return (state.documents || [])
      .filter((d) => d.subjectType === type && d.subjectId === id)
      .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  },

  // ---------------------------------------------------------------------
  // Is this person's file complete?
  // ---------------------------------------------------------------------
  // Walks the checklist and answers, line by line, one of:
  //
  //   complete  — satisfied, and not expired
  //   expired   — WAS satisfied, but the renewal lapsed. Deliberately distinct
  //               from missing: a lapsed annual recert is a person to chase,
  //               a missing one is an onboarding gap. Different problems.
  //   missing   — never satisfied
  //
  // Nothing here decides anyone is compliant. It reports what is and isn't in
  // the folder; a person still reads the documents.
  fileChecklistFor(subjectType, subjectId, person) {
    const checklist = checklistFor(subjectType === "client" ? "client" : "caregiver");
    const items = checklistItems(checklist);
    const subs = DTCStore.submissionsForSubject(subjectType, subjectId);
    const docs = DTCStore.documentsForSubject(subjectType, subjectId);
    const certs = person ? DTCStore.certificatesForUser(person) : [];
    const now = Date.now();

    const expiredBy = (iso, months) => {
      if (!months || !iso) return false;
      const due = new Date(iso);
      if (Number.isNaN(due.getTime())) return false;
      due.setMonth(due.getMonth() + months);
      return due.getTime() < now;
    };

    const rows = items.map((item) => {
      const by = item.satisfiedBy || {};
      let evidence = null;
      let at = null;

      if (by.type === "form") {
        const keys = by.anyOf || [by.schemaKey];
        const hit = subs.find((s) => keys.includes(s.schemaKey));
        if (hit) { evidence = { kind: "form", id: hit.id, label: hit.templateName || hit.schemaKey, url: hit.pdfUrl || null }; at = hit.submittedAt; }
      } else if (by.type === "certs") {
        // Count-agnostic on purpose — "all current modules", never a fixed six.
        const total = DTCStore.courseModuleCount ? DTCStore.courseModuleCount() : 0;
        const passed = certs.filter((c) => c.passed !== false).length;
        if (total > 0 && passed >= total) {
          const newest = certs.map((c) => c.date).filter(Boolean).sort().pop();
          evidence = { kind: "certs", label: `${passed} of ${total} modules` };
          at = newest;
        } else if (passed > 0) {
          evidence = null;
          at = null;
        }
      }

      // An upload satisfies ANY line, not just upload-only ones. That's what
      // lets a paper-signed packet complete a file without re-signing it.
      if (!evidence) {
        const up = docs.find((d) => d.checklistItemId === item.id);
        if (up) { evidence = { kind: "upload", id: up.id, label: up.fileName, url: up.url }; at = up.documentDate || up.uploadedAt; }
      }

      let status = "missing";
      if (evidence) status = expiredBy(at, item.renews) ? "expired" : "complete";

      return { ...item, status, evidence, satisfiedAt: at || null };
    });

    const required = rows.filter((r) => r.required);
    return {
      checklistKey: checklist.key,
      checklistLabel: checklist.label,
      rows,
      complete: required.every((r) => r.status === "complete"),
      counts: {
        required: required.length,
        complete: required.filter((r) => r.status === "complete").length,
        expired: required.filter((r) => r.status === "expired").length,
        missing: required.filter((r) => r.status === "missing").length,
      },
    };
  },

  // ---------------------------------------------------------------------
  // Soft delete (owner / dev portal only)
  // ---------------------------------------------------------------------
  // A filed submission is compliance evidence, so this never physically
  // erases one — see firestore.rules, which blocks a real delete outright
  // regardless of who's asking. What this does is stamp it removed-from-view:
  // who did it, when, and why. Restorable at any time, and still present in
  // full for an audit even while "deleted." The list a normal person sees
  // just filters these out.
  async softDeleteSubmission(id, reason) {
    await updateDoc(doc(db, "submissions", id), {
      deletedAt: new Date().toISOString(),
      deletedBy: state.user?.name || "Dev portal",
      deletedById: state.user?.id || null,
      deleteReason: reason || "",
    });
    await logAudit("submission_deleted", id, reason || "");
    await refresh();
  },

  async restoreSubmission(id) {
    await updateDoc(doc(db, "submissions", id), {
      deletedAt: null,
      deletedBy: null,
      deletedById: null,
      deleteReason: null,
    });
    await logAudit("submission_restored", id);
    await refresh();
  },

  getDeletedSubmissions() {
    return (state.submissions || []).filter((s) => !!s.deletedAt);
  },

  // Real, unrecoverable delete. Requested explicitly, after soft delete was
  // the recommendation — this is the escape hatch for when soft delete isn't
  // enough (real duplicate, entered against the wrong person entirely, or
  // something that genuinely should never have existed).
  //
  // Two things this does NOT relax:
  //   - firestore.rules still only grants delete to isDevUser(). Nobody else
  //     gets this by asking nicely, no matter what's in this function.
  //   - only a submission already sitting in the soft-deleted state can be
  //     hard-deleted. That's enforced here, not just as a UI nicety — it's a
  //     built-in cooling-off step: nothing goes straight from "filed" to
  //     "gone" in one click, only through "removed from view" first.
  //
  // Because the record itself is about to be unrecoverable, this writes the
  // audit entry BEFORE deleting and packs a real snapshot into it — form,
  // subject, who deleted it, when it was first soft-deleted and why, and now
  // who hard-deleted it and why. The audit trail is the only place any of
  // this will still exist afterward, so it has to actually say something.
  async hardDeleteSubmission(id, reason) {
    assertWritable();
    const sub = state.submissions.find((s) => s.id === id);
    if (!sub) throw new Error("Submission not found");
    if (!sub.deletedAt) throw new Error("Only an already soft-deleted submission can be permanently deleted");

    const snapshot = [
      `form: ${sub.templateName || sub.schemaKey || "unknown"}`,
      `subject: ${sub.clientName || sub.caregiverName || "unknown"}`,
      `originally submitted: ${sub.submittedAt || "unknown"}`,
      `soft-deleted by ${sub.deletedBy || "unknown"} on ${sub.deletedAt}: "${sub.deleteReason || ""}"`,
      `permanently deleted by ${state.user?.name || "Dev portal"}: "${reason || ""}"`,
    ].join(" | ");

    await logAudit("submission_hard_deleted", id, snapshot);
    await deleteDoc(doc(db, "submissions", id));
    await refresh();
  },

  async updateSubmission(id, patch) {
    assertWritable();
    const actor = state.user;
    const update = { ...patch };
    if (patch.status === "reviewed") {
      update.reviewedBy = actor?.name || "Office";
      update.reviewedAt = new Date().toISOString();
    }
    await updateDoc(doc(db, "submissions", id), update);
    await logAudit(patch.status === "reviewed" ? "form_reviewed" : "submission_updated", id);
    await refresh();
    return { id, ...patch };
  },

  async requestCorrection(id, note) {
    assertWritable();
    const actor = state.user;
    // Use the same status string the whole UI checks for ("needsCorrection"),
    // and append to an audit trail on the record itself.
    await updateDoc(doc(db, "submissions", id), {
      status: "needsCorrection",
      correctionNote: note,
      correctionHistory: arrayUnion({
        status: "needsCorrection",
        note: note || "",
        actorName: actor?.name || "Office",
        timestamp: new Date().toISOString(),
      }),
    });
    await logAudit("correction_requested", id, note || "");
    await refresh();
    return { id, status: "needsCorrection" };
  },

  async resubmitSubmission(id, payload) {
    assertWritable();
    const actor = state.user;
    await updateDoc(doc(db, "submissions", id), {
      ...payload,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      correctionNote: null,
      correctionHistory: arrayUnion({
        status: "submitted",
        actorName: actor?.name || payload.caregiverName || "Caregiver",
        timestamp: new Date().toISOString(),
      }),
    });
    await logAudit("form_resubmitted", id);
    await refresh();
    return { id, status: "submitted" };
  },

  // Tasks
  getTasks() { return state.tasks.slice(); },

  async createTask(task) {
    assertWritable();
    const docRef = await addDoc(collection(db, "tasks"), task);
    await refresh();
    return { id: docRef.id, ...task };
  },

  async updateTask(id, patch) {
    assertWritable();
    await updateDoc(doc(db, "tasks", id), patch);

    // Recurring compliance: completing a repeating task schedules the next one.
    // Without this, "supervisory visit every 90 days" and "care plan yearly"
    // fire exactly once and then silently stop — which is the failure mode a
    // survey would catch.
    if (patch.status === "completed") {
      const task = state.tasks.find((t) => t.id === id);
      if (task?.recurrence) {
        const next = nextDueDate(task.dueDate, task.recurrence);
        if (next) {
          const { id: _drop, completedAt: _c, ...carry } = task;
          await addDoc(collection(db, "tasks"), {
            ...carry,
            status: "pending",
            dueDate: next,
            // Points back at the occurrence that generated this one, so the
            // chain is auditable rather than looking like duplicate tasks.
            previousTaskId: id,
            createdAt: new Date().toISOString(),
          });
          await logAudit("recurring_task_scheduled", task.title, next);
        }
      }
    }

    await refresh();
    return { id, ...patch };
  },

  // Audit
  getAudit() { return state.audit.slice(); },

  // Users
  getUsers() { return state.users.slice(); },
  getToken() { return getStoredToken(); },

  async createUser(userInput) {
    assertWritable();
    const { email, password, ...rest } = userInput;
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const initials = rest.name.split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2) || '?';
    const docData = {
      ...rest,
      email: email.toLowerCase(),
      initials,
      status: "active",
      mustChangePassword: true, // Force new users to change their password
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };
    await setDoc(doc(db, "users", userCred.user.uid), docData);
    await logAudit("user_created", docData.name, ROLE_LABEL(rest.role));
    await refresh();
    return { id: userCred.user.uid, ...docData };
  },

  async updateUser(id, patch) {
    assertWritable();
    await updateDoc(doc(db, "users", id), patch);
    await logAudit("user_updated", state.users.find((u) => u.id === id)?.name || id);
    await refresh();
    return { id, ...patch };
  },

  async sendPasswordReset(email) {
    await sendPasswordResetEmail(auth, email);
  },

  // Clients
  async createClient(clientInput) {
    assertWritable();
    const initials = (clientInput.name || "?").split(' ').map((s) => s[0]).join('').toUpperCase().slice(0, 2) || '?';
    const data = { status: "active", initials, ...clientInput };
    const docRef = await addDoc(collection(db, "clients"), data);
    await logAudit("client_created", data.name);
    await refresh();
    return { id: docRef.id, ...data };
  },

  async updateClient(id, patch) {
    assertWritable();
    await updateDoc(doc(db, "clients", id), patch);
    await logAudit("client_updated", state.clients.find((c) => c.id === id)?.name || id);
    await refresh();
    return { id, ...patch };
  },

  // ─── Inbound review queue ────────────────────────────────────────────────
  // Documents that arrived from outside the app — emailed authorizations,
  // certification results, imported GoFormz records. The ingestion function
  // proposes who each one belongs to; a person decides.
  //
  // Both actions go through callable functions rather than writing Firestore
  // directly. Filing a document has to copy the object into the person's file,
  // create the submission record and write the audit entry as one server-side
  // step — a browser that could mark an entry "filed" on its own could leave
  // the record saying one thing and the filing cabinet another.

  getInbound() { return state.inbound.slice(); },

  // Newest first. Ambiguous and unmatched entries are the ones a person has to
  // think about, so they sort above the ones that only need a confirming click.
  getPendingInbound() {
    const rank = { ambiguous: 0, unmatched: 1, weak: 2, confident: 3 };
    return state.inbound
      .filter((d) => d.status === "pending")
      .sort(
        (a, b) =>
          (rank[a.confidence] ?? 9) - (rank[b.confidence] ?? 9) ||
          String(b.queuedAt || "").localeCompare(String(a.queuedAt || "")),
      );
  },

  async resolveInbound(inboundId, subjectType, subjectId) {
    const data = await callIngestion("resolve-inbound", { inboundId, subjectType, subjectId });
    await refresh();
    return data;
  },

  async dismissInbound(inboundId, reason) {
    const data = await callIngestion("dismiss-inbound", { inboundId, reason });
    await refresh();
    return data;
  },

  // Everyone a document could be filed against, in one list, tagged with which
  // filing cabinet they belong to. The picker needs both rosters together:
  // Debra Hardman is a client and Dean Hardman is a caregiver, and a reviewer
  // choosing between them is choosing between two different files.
  rosterForFiling() {
    const clients = state.clients.map((c) => ({
      id: c.id,
      name: c.name,
      subjectType: "client",
      detail: c.city || "",
    }));
    const staff = state.users
      .filter((u) => u.name && u.role !== "client")
      .map((u) => ({
        id: u.id,
        name: u.name,
        subjectType: "staff",
        detail: ROLE_LABEL(u.role),
      }));
    return [...clients, ...staff].sort((a, b) => a.name.localeCompare(b.name));
  },

  // ── Employment applications ──────────────────────────────────────────────
  // Submitted on careers.daretocarehomecare.com (dtc-jobapp), written into
  // this project's `applications` collection by that site's server function.
  // This app only ever reads and marks-reviewed — see the `applications` rule
  // in firestore.rules for why nothing here can create or rewrite one.

  getApplications() { return state.applications.slice(); },

  // Newest first — an applicant queue is read chronologically, unlike inbound
  // documents which are ranked by how much thinking they need.
  getPendingApplications() {
    return state.applications
      .filter((a) => a.status === "submitted")
      .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
  },

  async markApplicationReviewed(id, note) {
    assertWritable();
    const patch = {
      status: "reviewed",
      reviewedAt: new Date().toISOString(),
      reviewedBy: state.user?.name || auth.currentUser?.email || "Office Manager",
    };
    if (note) patch.reviewNote = note;
    await updateDoc(doc(db, "applications", id), patch);
    const app = state.applications.find((a) => a.id === id);
    await logAudit("application_reviewed", app?.applicant || id, note || "");
    await refresh();
  },

  // Files (uploads + the rendered PDF packet) live in Netlify Blobs on the
  // jobapp site, not in this project — there's no gs:// URL to hand back, so
  // this fetches the bytes through get-application-file.mjs (auth-checked
  // there too, not just here) and hands back a local object URL to open.
  async applicationFileUrl(blobKey) {
    const user = auth.currentUser;
    if (!user) throw new Error("You are signed out. Sign in again.");
    const token = await user.getIdToken();
    const res = await fetch(
      `https://careers.daretocarehomecare.com/api/application-file?key=${encodeURIComponent(blobKey)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Could not load file (${res.status}).`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  // Certificates (written by the course site; auto-linked to a user by email)
  getCertificates() { return state.certificates.slice(); },

  // Certificates that belong to a given user (matched by email or an explicit link).
  certificatesForUser(user) {
    if (!user) return [];
    const email = (user.email || "").toLowerCase();
    return state.certificates.filter(
      (c) => (c.email && String(c.email).toLowerCase() === email) || c.linkedUserId === user.id
    );
  },

  // How many course modules currently exist.
  //
  // Six today. Raina asked specifically that six not be written down anywhere,
  // because more courses are coming and a hardcoded six would silently pass
  // people who'd skipped the new ones. So this counts the distinct modules the
  // course site has actually issued certificates for, and grows by itself when
  // a seventh course goes live and the first person completes it.
  //
  // Trade-off worth knowing: a brand-new module raises the bar only once
  // somebody has passed it. That's the safe direction to be wrong in — it can
  // under-count briefly, never over-count and mark an incomplete file done.
  courseModuleCount() {
    const ids = new Set(
      (state.certificates || []).map((c) => c.courseId).filter(Boolean),
    );
    return ids.size;
  },

  async linkCertificate(certId, userId) {
    await updateDoc(doc(db, "certificates", certId), { linkedUserId: userId, linkedAt: new Date().toISOString() });
    await logAudit("certificate_linked", certId);
    await refresh();
  },

  // Create a one-time handoff token so the course site can identify the logged-in
  // user without a second sign-in. No personal data goes in the URL — only this token.
  async createCourseHandoff() {
    assertWritable();
    const me = state.user;
    if (!me) return null;

    // A new hire may only reach training after an office manager has released
    // it. Enforced here as well as in the portal UI, because this function is
    // what actually mints the credential the course site trusts — refusing at
    // the source means a hidden button can't be worked around.
    if (me.role === "newHire" && !me.coursesUnlockedAt) return null;

    const token = `h_${me.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await setDoc(doc(db, "courseHandoffs", token), {
      uid: me.id,
      name: me.name || "",
      email: (me.email || "").toLowerCase(),
      role: me.role || "",
      // Carried so the course site can verify release itself rather than
      // trusting that whoever opened the link was allowed to.
      coursesUnlockedAt: me.coursesUnlockedAt || null,
      createdAt: new Date().toISOString(),
      // Short-lived: a handoff is for one hop from the app to the course site,
      // not a durable key someone can save and reuse later.
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    return token;
  },

  // Generic audit hook for callers outside the store (e.g. login events)
  async logEvent(action, target, detail) { await logAudit(action, target, detail); },

  async getClientAssignments(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    return { assignments: client?.assignedUsers || [] };
  },

  // Training
  async getMyTrainingProgress() {
    const user = auth.currentUser;
    if (!user) return {};
    const u = state.users.find((x) => x.id === user.uid);
    return u?.trainingProgress || {};
  },

  async completeTrainingModule(moduleId) {
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), {
      [`trainingProgress.${moduleId}`]: new Date().toISOString()
    });
    await refresh();
  },

  async getUserTrainingProgress(userId) {
    const u = state.users.find((x) => x.id === userId);
    return { progress: u?.trainingProgress || {} };
  },

  async updateClientAssignments(clientId, userIds) {
    assertWritable();
    await updateDoc(doc(db, "clients", clientId), { assignedUsers: userIds });
    await refresh();
    return { assignments: userIds };
  },
};

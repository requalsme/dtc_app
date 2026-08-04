import { collection, doc, getDocs, setDoc, addDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage, firebaseConfig } from "../config/firebase";
// Static: FormWizard already imports this, so a dynamic import here would not
// split it into its own chunk. The heavy libraries (jspdf, html2canvas) are
// dynamically imported inside utils/pdf itself, which is where the win actually is.
// @ts-ignore
import { elementToPdfBlob } from "../utils/pdf";
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
];

const state = {
  templates: [],
  clients: [],
  submissions: [],
  audit: [],
  users: [],
  tasks: [],
  certificates: [],
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

    const [templates, clients, submissions, tasks, audit, users, certificates] = await Promise.all(requests);
    state.templates = (templates || []).map(normalizeTemplate);
    state.clients = clients;
    state.submissions = submissions;
    state.tasks = tasks;
    state.audit = audit;
    state.users = users;
    state.certificates = certificates || [];

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

export const DTCStore = {
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

  async updateSubmission(id, patch) {
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
    const docRef = await addDoc(collection(db, "tasks"), task);
    await refresh();
    return { id: docRef.id, ...task };
  },

  async updateTask(id, patch) {
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
    const initials = (clientInput.name || "?").split(' ').map((s) => s[0]).join('').toUpperCase().slice(0, 2) || '?';
    const data = { status: "active", initials, ...clientInput };
    const docRef = await addDoc(collection(db, "clients"), data);
    await logAudit("client_created", data.name);
    await refresh();
    return { id: docRef.id, ...data };
  },

  async updateClient(id, patch) {
    await updateDoc(doc(db, "clients", id), patch);
    await logAudit("client_updated", state.clients.find((c) => c.id === id)?.name || id);
    await refresh();
    return { id, ...patch };
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

  async linkCertificate(certId, userId) {
    await updateDoc(doc(db, "certificates", certId), { linkedUserId: userId, linkedAt: new Date().toISOString() });
    await logAudit("certificate_linked", certId);
    await refresh();
  },

  // Create a one-time handoff token so the course site can identify the logged-in
  // user without a second sign-in. No personal data goes in the URL — only this token.
  async createCourseHandoff() {
    const me = state.user;
    if (!me) return null;
    const token = `h_${me.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await setDoc(doc(db, "courseHandoffs", token), {
      uid: me.id,
      name: me.name || "",
      email: (me.email || "").toLowerCase(),
      createdAt: new Date().toISOString(),
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
    await updateDoc(doc(db, "clients", clientId), { assignedUsers: userIds });
    await refresh();
    return { assignments: userIds };
  },
};

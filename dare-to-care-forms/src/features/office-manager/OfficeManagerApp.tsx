import { useEffect, useMemo, useState } from "react";
// @ts-ignore
import { Icon } from "../../components/fields.jsx";
// @ts-ignore
import { DTCStore as Store } from "../../components/store.js";
// @ts-ignore
import { PdfPreview, getSchema } from "../../components/forms/FormWizard";
import { FormWizard } from "../../components/forms/FormWizard";
import { OfficeDashboard } from "./OfficeDashboard";
import { FiledDocuments } from "../../components/FiledDocuments";
import { ClientKeyFacts } from "../../components/ClientKeyFacts";
import { NewHireReview } from "./NewHireReview";
import { InboundQueue } from "./InboundQueue";
import { ApplicationsReview } from "./ApplicationsReview";
import { fmtDate } from "../../utils/format";

const relTime = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return fmtDate(iso.slice(0, 10));
};

// ── Correction Modal ────────────────────────────────────────────────────────

function CorrectionModal({ onConfirm, onCancel }: { onConfirm: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!note.trim()) { setError("A correction reason is required."); return; }
    onConfirm(note.trim());
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="corr-title">
        <div className="modal-head">
          <h3 id="corr-title">Request correction</h3>
          <button className="modal-close" onClick={onCancel} aria-label="Cancel"><Icon n="x" s={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12 }}>
            The caregiver will see this reason and be asked to correct and resubmit the form.
          </p>
          <label className="form-label" htmlFor="corr-note">Reason for correction <span style={{ color: "var(--red)" }}>*</span></label>
          <textarea
            id="corr-note"
            className="insp-input"
            rows={4}
            placeholder="e.g. Signature date is missing. Please re-sign and resubmit."
            value={note}
            onChange={(e) => { setNote(e.target.value); setError(""); }}
            autoFocus
          />
          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="dbtn dbtn-ghost" onClick={onCancel}>Cancel</button>
          <button className="dbtn dbtn-warn" onClick={submit}>
            <Icon n="alert" s={14} /> Request correction
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Start Form Modal (Office Manager starts office-role forms) ──────────────

function StartFormModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const [schemaKey, setSchemaKey] = useState("supervisoryVisit");
  const [clientId, setClientId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState("normal");
  const [recurrence, setRecurrence] = useState("");
  const [startingWizard, setStartingWizard] = useState(false);

  const officeTemplates = Store.getPublishedTemplates
    ? Store.getPublishedTemplates().filter((t: any) => t.completedBy?.includes("officeManager"))
    : [];
  const caregivers = Store.getUsers().filter((u: any) => u.role === "caregiver");
  const clients = Store.clients;

  const createTaskAndOpen = async () => {
    const client = clientId ? clients.find((c: any) => c.id === clientId) : null;
    const caregiver = assignedToId ? caregivers.find((u: any) => u.id === assignedToId) : null;
    const schema = getSchema(schemaKey);

    await Store.createTask({
      title: `${schema?.name || schemaKey}${client ? ` — ${client.name}` : ""}`,
      taskType: "supervisory_visit",
      schemaKey,
      clientId: clientId || null,
      clientName: client?.name || null,
      assignedToId: assignedToId || "u_om",
      assignedToName: caregiver?.name || "Office Manager",
      dueDate,
      priority,
      status: "pending",
      // When set, completing this task automatically schedules the next one.
      // This is what makes "supervisory visit every 90 days" and "care plan
      // yearly" hold without anyone remembering to re-create them.
      recurrence: recurrence || null,
    });

    onToast("Task created");
    setStartingWizard(true);
  };

  if (startingWizard) {
    const client = clientId ? clients.find((c: any) => c.id === clientId) : null;
    return (
      <FormWizard
        schemaKey={schemaKey}
        initialClient={client}
        autoApply
        onClose={onClose}
        onSubmit={async ({ schema, values, score, client: c }: any) => {
          await Store.addSubmission({
            schemaKey: schema.key,
            clientId: c?.id || null,
            clientName: c?.name || null,
            values, score,
          });
          onToast(`${schema.name} submitted`);
          onClose();
        }}
        submitLabel="Submit office form"
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sf-title">
        <div className="modal-head">
          <h3 id="sf-title">Start office form</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon n="x" s={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label className="form-label" htmlFor="sf-schema">Form type</label>
            <select id="sf-schema" className="ds-select" value={schemaKey} onChange={(e) => setSchemaKey(e.target.value)}>
              {officeTemplates.length === 0
                ? <option value="supervisoryVisit">Supervisory Visit</option>
                : officeTemplates.map((t: any) => <option key={t.key} value={t.key}>{t.name}</option>)
              }
            </select>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="sf-client">Client (optional)</label>
            <select id="sf-client" className="ds-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">No client</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="sf-caregiver">Assign to caregiver (optional)</label>
            <select id="sf-caregiver" className="ds-select" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
              <option value="">Me (Office Manager)</option>
              {caregivers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="sf-due">Due date</label>
            <input id="sf-due" type="date" className="insp-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="sf-priority">Priority</label>
            <select id="sf-priority" className="ds-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="urgent">Urgent</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="sf-recur">Repeat</label>
            <select id="sf-recur" className="ds-select" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              <option value="">Does not repeat</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Every 90 days</option>
              <option value="semiannual">Every 6 months</option>
              <option value="annual">Yearly</option>
            </select>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 4 }}>
              {recurrence
                ? "Completing this task automatically schedules the next one."
                : "Supervisory visits repeat every 90 days; care plans yearly."}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="dbtn dbtn-ghost" onClick={onClose}>Cancel</button>
          <button className="dbtn dbtn-primary" onClick={createTaskAndOpen}>
            <Icon n="plus" s={14} /> Start form
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Submissions List ────────────────────────────────────────────────────────

function SubmissionsList({ onView }: { onView: (sub: any) => void }) {
  const [, force] = useState(0);
  const [filterClient, setFilterClient] = useState("");
  const [filterForm, setFilterForm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const submissions = Store.getSubmissions();

  const filtered = useMemo(() => {
    return submissions.filter((s: any) => {
      if (filterClient && s.clientName !== filterClient) return false;
      if (filterForm && s.schemaKey !== filterForm) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.clientName?.toLowerCase().includes(q) && !s.caregiverName?.toLowerCase().includes(q) && !s.templateName?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [submissions, filterClient, filterForm, filterStatus, search]);

  const clientNames = Array.from(new Set<string>(submissions.map((s: any) => String(s.clientName)).filter(Boolean)));
  const formKeys = Array.from(new Set<string>(submissions.map((s: any) => String(s.schemaKey)).filter(Boolean)));

  const statusChip = (status: string) => {
    if (status === "reviewed") return <span className="spill pub"><span className="pip" />Reviewed</span>;
    if (status === "needsCorrection") return <span className="spill warn"><span className="pip" />Needs correction</span>;
    return <span className="spill ver"><span className="pip" />Submitted</span>;
  };

  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>Submissions</h1>
          <p>{submissions.length} records across all caregivers and workflows.</p>
        </div>
      </div>

      <div className="ds-filters">
        <input className="ds-search" placeholder="Search by name, caregiver, form…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="ds-select" value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
          <option value="">All clients</option>
          {clientNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="ds-select" value={filterForm} onChange={(e) => setFilterForm(e.target.value)}>
          <option value="">All forms</option>
          {formKeys.map((key) => <option key={key} value={key}>{Store.schemaName(key)}</option>)}
        </select>
        <select className="ds-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
          <option value="needsCorrection">Needs correction</option>
        </select>
      </div>

      <div className="ds-panel">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Client / Form</th>
              <th>Caregiver</th>
              <th>Date</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((s: any) => {
              const schema = getSchema(s.schemaKey);
              return (
                <tr key={s.id} onClick={() => onView(s)}>
                  <td>
                    <span className="row-ic">
                      <span className="ti"><Icon n={schema?.icon || "file"} s={16} /></span>
                      <span>
                        <span className="cell-main">{s.clientName || "Employee form"}</span>
                        <span className="cell-sub">{schema?.name || s.schemaKey}</span>
                      </span>
                    </span>
                  </td>
                  <td style={{ color: "var(--ink-2)" }}>{s.caregiverName}</td>
                  <td style={{ color: "var(--ink-3)", fontSize: 12 }}>{relTime(s.submittedAt)}</td>
                  <td>{statusChip(s.status)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="dbtn dbtn-ghost" style={{ padding: "6px 11px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onView(s); }}>
                      <Icon n="eye" s={13} /> View
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--ink-3)" }}>No submissions match the current filters.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Submission Detail ───────────────────────────────────────────────────────

function SubmissionDetail({ submission, onClose, onToast }: { submission: any; onClose: () => void; onToast: (m: string) => void }) {
  const [correctionModal, setCorrectionModal] = useState(false);
  const [, force] = useState(0);
  const schema = getSchema(submission.schemaKey);

  // Live-refresh the submission
  const [liveSub, setLiveSub] = useState(submission);
  useEffect(() => {
    return Store.subscribe(() => {
      const fresh = Store.getSubmissions().find((s: any) => s.id === submission.id);
      if (fresh) setLiveSub(fresh);
    });
  }, [submission.id]);

  const requestCorrection = async (note: string) => {
    try {
      await Store.requestCorrection(liveSub.id, note);
      onToast("Correction requested — caregiver notified");
      setCorrectionModal(false);
      force((v) => v + 1);
    } catch (err: any) {
      onToast(err?.message || "Could not request correction");
      setCorrectionModal(false);
    }
  };

  const markReviewed = async () => {
    try {
      await Store.updateSubmission(liveSub.id, { status: "reviewed" });
      onToast("Submission marked reviewed");
      onClose();
    } catch (err: any) {
      onToast(err?.message || "Could not mark reviewed");
    }
  };

  return (
    <div>
      {correctionModal && (
        <CorrectionModal
          onConfirm={requestCorrection}
          onCancel={() => setCorrectionModal(false)}
        />
      )}

      <div className="ds-ph">
        <div>
          <button className="dbtn dbtn-ghost" style={{ marginBottom: 10, padding: "6px 12px", fontSize: 12 }} onClick={onClose}>
            <Icon n="arrowLeft" s={14} /> All submissions
          </button>
          <h1>{schema?.name || liveSub.schemaKey}</h1>
          <p>
            {liveSub.clientName || "Employee form"} · submitted by {liveSub.caregiverName} · {relTime(liveSub.submittedAt)}
            {liveSub.reviewedBy && <span> · Reviewed by {liveSub.reviewedBy}</span>}
          </p>
        </div>
        <div className="actions">
          {liveSub.status === "submitted" ? (
            <>
              <button className="dbtn dbtn-ghost" onClick={() => setCorrectionModal(true)}>
                <Icon n="alert" s={15} /> Request correction
              </button>
              <button className="dbtn dbtn-primary" onClick={markReviewed}>
                <Icon n="check" s={15} /> Mark reviewed
              </button>
            </>
          ) : liveSub.status === "needsCorrection" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="spill warn"><span className="pip" />Awaiting caregiver correction</span>
              {liveSub.correctionNote && (
                <span style={{ fontSize: 12, color: "var(--amber-dark)" }}>"{liveSub.correctionNote}"</span>
              )}
            </div>
          ) : (
            <span className="spill pub"><span className="pip" />Reviewed</span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 700 }}>
        {schema ? <PdfPreview schema={schema} values={liveSub.values} score={liveSub.score || { total: 0, tier: null }} submission={liveSub} /> : null}

        {/* Correction history panel */}
        {liveSub.correctionHistory?.length > 0 && (
          <div className="admin-panel" style={{ marginTop: 16 }}>
            <div className="admin-panel-head">
              <div>
                <h3>Status history</h3>
                <p>Full audit trail of every status change on this submission.</p>
              </div>
            </div>
            <div style={{ padding: "0 0 8px" }}>
              {liveSub.correctionHistory.map((entry: any, i: number) => (
                <div key={i} className="history-row">
                  <span className="history-dot" style={{ background: entry.status === "needsCorrection" ? "var(--amber)" : entry.status === "reviewed" ? "var(--accent)" : "var(--ink-4)" }} />
                  <div className="history-body">
                    <div className="history-header">
                      <strong>{entry.actorName}</strong>
                      <span className="spill ver" style={{ marginLeft: 6 }}>{entry.role}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>{relTime(entry.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>
                      {entry.status === "needsCorrection" ? "Requested correction" : entry.status === "submitted" ? "Resubmitted" : entry.status}
                    </div>
                    {entry.note && (
                      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, fontStyle: "italic" }}>"{entry.note}"</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {liveSub.pdfUrl ? (
          <div className="record-actions" style={{ marginTop: 16 }}>
            <a className="btn btn-ghost btn-block" href={liveSub.pdfUrl} target="_blank" rel="noreferrer">
              <Icon n="download" s={16} /> Download full PDF document
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Folder checklist summary ─────────────────────────────────────────────────
// Renders Store.fileChecklistFor() — "is this file complete" — above the raw
// list of filed documents. The engine (components/file-checklist.js) already
// existed; this is the first screen that actually shows it to a person.

function ChecklistSummary({ subjectType, subjectId, person }: { subjectType: "client" | "staff"; subjectId: string; person?: any }) {
  const [, force] = useState(0);
  useEffect(() => Store.subscribe(() => force((v) => v + 1)), [subjectId]);

  // fileChecklistFor expects the same subjectType convention as
  // submissionsForSubject/documentsForSubject ("client" or "staff") — it
  // picks the caregiver vs. client checklist internally from that.
  const result = Store.fileChecklistFor(subjectType, subjectId, person);
  const { rows, counts, checklistLabel } = result;

  const groups: { label: string; rows: any[] }[] = [];
  for (const r of rows) {
    let g = groups.find((g2) => g2.label === r.groupLabel);
    if (!g) { g = { label: r.groupLabel, rows: [] }; groups.push(g); }
    g.rows.push(r);
  }

  const pct = counts.required ? Math.round((counts.complete / counts.required) * 100) : 100;
  const chip = (status: string) => {
    if (status === "complete") return <span className="spill pub"><span className="pip" />Complete</span>;
    if (status === "expired") return <span className="spill warn"><span className="pip" />Expired</span>;
    return <span className="spill correction"><span className="pip" />Missing</span>;
  };

  return (
    <div className="ds-panel" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <strong>{checklistLabel}</strong>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
            {counts.complete} of {counts.required} required items complete
            {counts.expired > 0 && ` · ${counts.expired} expired`}
            {counts.missing > 0 && ` · ${counts.missing} missing`}
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 22, color: pct === 100 ? "var(--accent-deep)" : "var(--ink-2)" }}>{pct}%</div>
      </div>
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--ink-3)", marginBottom: 4 }}>
            {g.label}
          </div>
          {g.rows.map((r: any) => (
            <div
              key={r.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}
            >
              <span style={{ fontSize: 13 }}>
                {r.label}
                {!r.required && <span style={{ color: "var(--ink-4)" }}> (optional)</span>}
              </span>
              {chip(r.status)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Client Directory ────────────────────────────────────────────────────────

function ClientDirectory() {
  const [, force] = useState(0);
  const [search, setSearch] = useState("");
  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const [openClient, setOpenClient] = useState<any>(null);
  const [clientTab, setClientTab] = useState<"facts" | "docs">("facts");

  const clients = Store.clients.filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Drilled into one client: show their file — every document completed about
  // them, in one place, the way a paper folder would hold it.
  if (openClient) {
    return (
      <div>
        <div className="ds-ph">
          <div>
            <button className="btn btn-ghost" style={{ marginBottom: 8 }} onClick={() => setOpenClient(null)}>
              <Icon n="arrowLeft" s={16} /> All clients
            </button>
            <h1>{openClient.name}</h1>
            <p>
              Client file — every form completed about {openClient.name}.
              {openClient.dob ? ` DOB ${fmtDate(openClient.dob)}.` : ""}
              {openClient.mrn ? ` MRN ${openClient.mrn}.` : ""}
            </p>
          </div>
        </div>
        <div className="ds-filters" style={{ gap: 6 }}>
          <button
            className={clientTab === "facts" ? "dbtn dbtn-primary" : "dbtn dbtn-ghost"}
            onClick={() => setClientTab("facts")}
          >
            Key details
          </button>
          <button
            className={clientTab === "docs" ? "dbtn dbtn-primary" : "dbtn dbtn-ghost"}
            onClick={() => setClientTab("docs")}
          >
            Filed documents
          </button>
        </div>
        <ChecklistSummary subjectType="client" subjectId={openClient.id} />
        <div className="ds-panel" style={{ padding: 16 }}>
          {clientTab === "facts" ? (
            <ClientKeyFacts clientId={openClient.id} />
          ) : (
            <FiledDocuments
              subjectType="client"
              subjectId={openClient.id}
              subjectName={openClient.name}
              emptyHint={`No forms have been filed for ${openClient.name} yet.`}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>Clients</h1>
          <p>Shared directory with profile details used for autofill and visit records. Select a client to open their file.</p>
        </div>
      </div>
      <div className="ds-filters">
        <input className="ds-search" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="ds-panel">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Client</th><th>DOB</th><th>MRN</th><th>Physician</th><th>Allergies</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c: any) => (
              <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setOpenClient(c)}>
                <td>
                  <span className="row-ic">
                    <span className="ti">{c.initials}</span>
                    <span>
                      <span className="cell-main">{c.name}</span>
                      {c.notes && <span className="cell-sub">{c.notes}</span>}
                    </span>
                  </span>
                </td>
                <td>{fmtDate(c.dob)}</td>
                <td>{c.mrn}</td>
                <td>{c.physician}</td>
                <td style={{ color: c.allergies !== "None known" ? "var(--amber)" : "var(--ink-3)" }}>{c.allergies}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--ink-3)" }}>No clients found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Team Directory ──────────────────────────────────────────────────────────

function TeamDirectory() {
  const [, force] = useState(0);
  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const [openStaff, setOpenStaff] = useState<any>(null);

  const caregivers = Store.getUsers().filter((u: any) => u.role === "caregiver");

  // One staff member's own file: their signed paperwork and policy
  // acknowledgements (forms about a client live on that client's file instead).
  if (openStaff) {
    return (
      <div>
        <div className="ds-ph">
          <div>
            <button className="btn btn-ghost" style={{ marginBottom: 8 }} onClick={() => setOpenStaff(null)}>
              <Icon n="arrowLeft" s={16} /> All team members
            </button>
            <h1>{openStaff.name}</h1>
            <p>Staff file — signed paperwork and acknowledgements for {openStaff.name}.</p>
          </div>
        </div>
        <ChecklistSummary subjectType="staff" subjectId={openStaff.id} person={openStaff} />
        <div className="ds-panel" style={{ padding: 16 }}>
          <FiledDocuments
            subjectType="staff"
            subjectId={openStaff.id}
            subjectName={openStaff.name}
            emptyHint={`No paperwork has been filed for ${openStaff.name} yet.`}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>Team</h1>
          <p>Caregiver roster with live submission counts. Select someone to open their staff file.</p>
        </div>
      </div>
      <div className="ds-panel">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Caregiver</th><th>Email</th><th>Submissions</th><th>Last login</th>
            </tr>
          </thead>
          <tbody>
            {caregivers.map((u: any) => {
              const subs = Store.getSubmissions().filter((s: any) => s.caregiverId === u.id);
              return (
                <tr key={u.id} style={{ cursor: "pointer" }} onClick={() => setOpenStaff(u)}>
                  <td>
                    <span className="row-ic">
                      <span className="ti">{u.initials}</span>
                      <span>
                        <span className="cell-main">{u.name}</span>
                        <span className="cell-sub">{u.status}</span>
                      </span>
                    </span>
                  </td>
                  <td>{u.email}</td>
                  <td>{subs.length}</td>
                  <td style={{ color: "var(--ink-3)", fontSize: 12 }}>{u.lastLoginAt ? relTime(u.lastLoginAt) : "Never"}</td>
                </tr>
              );
            })}
            {caregivers.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--ink-3)" }}>No caregivers found on the team.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Audit View ──────────────────────────────────────────────────────────────

function AuditView() {
  const [, force] = useState(0);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const audit = Store.getAudit().filter((e: any) => {
    if (filterRole && e.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.actor?.toLowerCase().includes(q) && !e.action?.toLowerCase().includes(q) && !e.target?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>Audit log</h1>
          <p>Every meaningful event captured for traceability and compliance.</p>
        </div>
      </div>
      <div className="ds-filters">
        <input className="ds-search" placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="ds-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="officeManager">Office Manager</option>
          <option value="caregiver">Caregiver</option>
        </select>
      </div>
      <div className="ds-panel">
        <table className="ds-table">
          <thead>
            <tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr>
          </thead>
          <tbody>
            {audit.map((e: any) => (
              <tr key={e.id} style={{ cursor: "default" }}>
                <td style={{ color: "var(--ink-3)", fontSize: 12, whiteSpace: "nowrap" }}>{relTime(e.timestamp)}</td>
                <td>
                  <span className="cell-main">{e.actor}</span>
                  {" "}<span className="spill ver" style={{ marginLeft: 4 }}>{e.role}</span>
                </td>
                <td>{e.action.replaceAll("_", " ")}</td>
                <td>{e.target}</td>
              </tr>
            ))}
            {audit.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--ink-3)" }}>No audit events match the criteria.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────

export function OfficeManagerApp({ page, onNav, onToast }: { page: string; onNav: (p: string) => void; onToast: (m: string) => void }) {
  const [viewingSubmission, setViewingSubmission] = useState<any>(null);
  const [showStartForm, setShowStartForm] = useState(false);

  useEffect(() => { setViewingSubmission(null); }, [page]);

  if (viewingSubmission) {
    return <SubmissionDetail submission={viewingSubmission} onClose={() => setViewingSubmission(null)} onToast={onToast} />;
  }

  return (
    <>
      {showStartForm && (
        <StartFormModal
          onClose={() => setShowStartForm(false)}
          onToast={(m) => { onToast(m); setShowStartForm(false); }}
        />
      )}

      {page === "submissions" && <SubmissionsList onView={setViewingSubmission} />}
      {page === "clients" && <ClientDirectory />}
      {page === "new-hires" && <NewHireReview onToast={onToast} />}
      {page === "inbound" && <InboundQueue onToast={onToast} />}
      {page === "applications" && <ApplicationsReview onToast={onToast} />}
      {page === "team" && <TeamDirectory />}
      {page === "audit" && <AuditView />}
      {page === "dashboard" && <OfficeDashboard onStartForm={() => setShowStartForm(true)} onNav={onNav} />}
      {!["submissions", "clients", "new-hires", "inbound", "applications", "team", "audit", "dashboard"].includes(page) && (
        <OfficeDashboard onStartForm={() => setShowStartForm(true)} onNav={onNav} />
      )}
    </>
  );
}

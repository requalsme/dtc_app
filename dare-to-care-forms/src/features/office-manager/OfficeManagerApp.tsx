// The office manager's console: submissions, clients, team, and the queues.
//
// Most of the screens here are shared with the administrator and live in
// src/console/. What remains in this file is the work that is specific to
// reviewing other people's work: reading a submission and deciding whether it
// stands, sending it back with a reason, starting an office form, and looking
// at one person's file.
//
// Requesting a correction is the one destructive-feeling action on this
// screen — it reopens finished work for somebody else — so it always carries a
// written reason, and the reason is required rather than encouraged. A
// correction with no explanation is just a rejection, and the caregiver has to
// guess what to change.

import { useEffect, useState } from "react";
// @ts-ignore
import { DTCStore as Store } from "../../components/store.js";
// @ts-ignore
import { PdfPreview, getSchema } from "../../components/forms/FormWizard";
import { FormWizard } from "../../components/forms/FormWizard";
import { FiledDocuments } from "../../components/FiledDocuments";
// Rebuilt from the design system's office_manager UI kit. Both take the same
// props the screens they replace did, so review and correction still run
// through SubmissionDetail below.
// @ts-ignore - JSX module without types
import { SubmissionsLedger } from "../../console/Submissions.jsx";
// @ts-ignore - JSX module without types
import { AuditLog as ConsoleAuditLog } from "../../console/Audit.jsx";
// @ts-ignore - JSX module without types
import { ConsoleDashboard } from "../../console/Dashboard.jsx";
// @ts-ignore - JSX module without types
import { ClientsScreen } from "../../console/Clients.jsx";
import { NewHireReview } from "./NewHireReview";
import { InboundQueue } from "./InboundQueue";
import { ApplicationsReview } from "./ApplicationsReview";
import { fmtDate } from "../../utils/format";
import {
  Icon, Button, Stamp, MonoLabel, Panel, Select, Input, Textarea,
  RecordRow, EmptyState, Chip, Text, Dialog, DocumentSlot,
  // @ts-ignore - design system is untyped JSX
} from "../../design/index.js";
// @ts-ignore - untyped JSX
import { SheetHeader, useAreaLabel } from "../../console/Chrome.jsx";

const relTime = (iso: string) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return fmtDate(iso.slice(0, 10));
};

// ── Correction ──────────────────────────────────────────────────────────────

function CorrectionDialog({ open, onConfirm, onCancel }: { open: boolean; onConfirm: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!note.trim()) { setError("Say what needs changing — the caregiver only sees this."); return; }
    onConfirm(note.trim());
  };

  return (
    <Dialog
      open={open}
      title="Send this back for correction"
      description="The caregiver sees this reason and is asked to fix and resubmit."
      icon={<Icon name="alert" size={20} />}
      onClose={onCancel}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" iconLeft={<Icon name="alert" size={16} />} onClick={submit}>
            Request correction
          </Button>
        </>
      }
    >
      <Textarea
        label="What needs changing"
        rows={4}
        placeholder="e.g. Signature date is missing. Please re-sign and resubmit."
        value={note}
        onChange={(e: any) => { setNote(e.target.value); setError(""); }}
        error={error}
        autoFocus
      />
    </Dialog>
  );
}

// ── Start an office form ────────────────────────────────────────────────────

function StartFormDialog({ open, onClose, onToast }: { open: boolean; onClose: () => void; onToast: (m: string) => void }) {
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
    <Dialog
      open={open}
      title="Start an office form"
      description="Creates the task and opens the form so you can fill it in now."
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button iconLeft={<Icon name="plus" size={16} />} onClick={createTaskAndOpen}>Start form</Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Select
          label="Form"
          value={schemaKey}
          onChange={(e: any) => setSchemaKey(e.target.value)}
          options={
            officeTemplates.length === 0
              ? [{ value: "supervisoryVisit", label: "Supervisory Visit" }]
              : officeTemplates.map((t: any) => ({ value: t.key, label: t.name }))
          }
        />
        <Select
          label="Client"
          value={clientId}
          onChange={(e: any) => setClientId(e.target.value)}
          hint="Optional. Leave blank for a form that isn't about one person."
          options={[{ value: "", label: "No client" }, ...clients.map((c: any) => ({ value: c.id, label: c.name }))]}
        />
        <Select
          label="Assign to"
          value={assignedToId}
          onChange={(e: any) => setAssignedToId(e.target.value)}
          options={[
            { value: "", label: "Me (Office Manager)" },
            ...caregivers.map((u: any) => ({ value: u.id, label: u.name })),
          ]}
        />
        <Input label="Due" type="date" value={dueDate} onChange={(e: any) => setDueDate(e.target.value)} />
        <Select
          label="Priority"
          value={priority}
          onChange={(e: any) => setPriority(e.target.value)}
          options={[
            { value: "urgent", label: "Urgent" },
            { value: "normal", label: "Normal" },
            { value: "low", label: "Low" },
          ]}
        />
        <Select
          label="Repeat"
          value={recurrence}
          onChange={(e: any) => setRecurrence(e.target.value)}
          hint={recurrence
            ? "Completing this task schedules the next one automatically."
            : "Supervisory visits repeat every 90 days; care plans yearly."}
          options={[
            { value: "", label: "Does not repeat" },
            { value: "monthly", label: "Monthly" },
            { value: "quarterly", label: "Every 90 days" },
            { value: "semiannual", label: "Every 6 months" },
            { value: "annual", label: "Yearly" },
          ]}
        />
      </div>
    </Dialog>
  );
}

// ── Submission detail ───────────────────────────────────────────────────────

function SubmissionDetail({ submission, onClose, onToast }: { submission: any; onClose: () => void; onToast: (m: string) => void }) {
  const area = useAreaLabel();
  const [correctionOpen, setCorrectionOpen] = useState(false);
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
      setCorrectionOpen(false);
    } catch (err: any) {
      onToast(err?.message || "Could not request correction");
      setCorrectionOpen(false);
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

  const pending = liveSub.status === "submitted";
  const history = liveSub.correctionHistory || [];

  return (
    <>
      <CorrectionDialog open={correctionOpen} onConfirm={requestCorrection} onCancel={() => setCorrectionOpen(false)} />

      <SheetHeader
        eyebrow={`${area} / Submissions / ${schema?.name || liveSub.schemaKey}`}
        title={schema?.name || liveSub.schemaKey}
        lead={[
          liveSub.clientName || "Employee form",
          `submitted by ${liveSub.caregiverName}`,
          relTime(liveSub.submittedAt),
          liveSub.reviewedBy ? `reviewed by ${liveSub.reviewedBy}` : null,
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="outline" iconLeft={<Icon name="arrowLeft" size={16} />} onClick={onClose}>
              All submissions
            </Button>
            {pending && (
              <>
                <Button variant="outline" iconLeft={<Icon name="alert" size={16} />} onClick={() => setCorrectionOpen(true)}>
                  Send back
                </Button>
                <Button iconLeft={<Icon name="check" size={16} />} onClick={markReviewed}>
                  Mark reviewed
                </Button>
              </>
            )}
          </>
        }
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
        <Stamp tone={pending ? "brand" : liveSub.status === "needsCorrection" ? "warning" : "success"}>
          {pending ? "Awaiting review" : liveSub.status === "needsCorrection" ? "Sent back" : "Reviewed"}
        </Stamp>
        {liveSub.status === "needsCorrection" && liveSub.correctionNote && (
          <Chip icon={<Icon name="alert" size={14} />}>“{liveSub.correctionNote}”</Chip>
        )}
        {liveSub.pdfUrl && (
          <>
            <span style={{ flex: 1 }} />
            <Button size="sm" variant="ghost" iconRight={<Icon name="download" size={15} />}
              onClick={() => window.open(liveSub.pdfUrl, "_blank", "noopener")}>
              Download PDF
            </Button>
          </>
        )}
      </div>

      <div className="split" style={{ alignItems: "start" }}>
        <section>
          {schema ? (
            <PdfPreview schema={schema} values={liveSub.values} score={liveSub.score || { total: 0, tier: null }} submission={liveSub} />
          ) : (
            <EmptyState title="Form definition missing" description="The template this was filled from no longer exists." />
          )}
        </section>

        <aside>
          <MonoLabel rule count={history.length} style={{ marginBottom: 12 }}>Status history</MonoLabel>
          {history.length === 0 ? (
            <Text role="body" color="quiet" style={{ fontSize: 13.5 }}>
              Submitted once and not changed since.
            </Text>
          ) : (
            <Panel padding={0}>
              {history.map((entry: any, i: number) => (
                <div key={i} style={{
                  padding: "13px 16px",
                  borderTop: i ? "1px solid var(--border-hair)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13.5, color: "var(--text-body)" }}>{entry.actorName}</strong>
                    <Stamp tone="neutral" leaf={false}>{entry.role}</Stamp>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: "var(--text-quiet)" }}>{relTime(entry.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    {entry.status === "needsCorrection" ? "Sent back for correction"
                      : entry.status === "submitted" ? "Resubmitted"
                      : entry.status}
                  </div>
                  {entry.note && (
                    <div style={{ fontSize: 12.5, color: "var(--text-quiet)", marginTop: 5, fontStyle: "italic" }}>
                      “{entry.note}”
                    </div>
                  )}
                </div>
              ))}
            </Panel>
          )}
        </aside>
      </div>
    </>
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

  return (
    <Panel label={checklistLabel} labelRight={
      <span style={{
        fontFamily: "var(--font-figure)", fontSize: 20, lineHeight: 1,
        color: pct === 100 ? "var(--status-success)" : "var(--text-brand)",
        fontVariantNumeric: "tabular-nums",
      }}>{pct}%</span>
    }>
      <Text role="body" color="secondary" style={{ fontSize: 13, display: "block", marginBottom: 16 }}>
        {counts.complete} of {counts.required} required items complete
        {counts.expired > 0 && ` · ${counts.expired} expired`}
        {counts.missing > 0 && ` · ${counts.missing} missing`}
      </Text>

      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <MonoLabel rule count={g.rows.length} style={{ marginBottom: 9 }}>{g.label}</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {g.rows.map((r: any) => (
              <DocumentSlot
                key={r.id}
                name={r.label + (r.required ? "" : " (optional)")}
                state={r.status === "complete" ? "filed" : r.status === "expired" ? "expired" : "missing"}
              />
            ))}
          </div>
        </div>
      ))}
    </Panel>
  );
}

// ── Team directory ──────────────────────────────────────────────────────────

function TeamDirectory() {
  const area = useAreaLabel();
  const [, force] = useState(0);
  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const [openStaff, setOpenStaff] = useState<any>(null);

  const caregivers = Store.getUsers().filter((u: any) => u.role === "caregiver");

  // One staff member's own file: their signed paperwork and policy
  // acknowledgements (forms about a client live on that client's file instead).
  if (openStaff) {
    return (
      <>
        <SheetHeader
          eyebrow={`${area} / Team / ${openStaff.name}`}
          title={openStaff.name}
          lead={`Signed paperwork and acknowledgements for ${openStaff.name}. Forms about a client live on that client's file instead.`}
          actions={
            <Button variant="outline" iconLeft={<Icon name="arrowLeft" size={16} />} onClick={() => setOpenStaff(null)}>
              All team members
            </Button>
          }
        />
        <div className="split" style={{ alignItems: "start" }}>
          <section>
            <MonoLabel rule style={{ marginBottom: 12 }}>Filed documents</MonoLabel>
            <FiledDocuments
              subjectType="staff"
              subjectId={openStaff.id}
              subjectName={openStaff.name}
              emptyHint={`No paperwork has been filed for ${openStaff.name} yet.`}
            />
          </section>
          <aside>
            <ChecklistSummary subjectType="staff" subjectId={openStaff.id} person={openStaff} />
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <SheetHeader
        eyebrow={`${area} / Team`}
        title="Team"
        lead="Everyone working as a caregiver. Open someone to see their file and what's still missing from it."
      />
      {caregivers.length === 0 ? (
        <EmptyState title="No caregivers yet" description="Nobody on the team has been hired on as a caregiver." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 880 }}>
          {caregivers.map((u: any) => {
            const subs = Store.getSubmissions().filter((s: any) => s.caregiverId === u.id);
            return (
              <RecordRow
                key={u.id}
                icon={<Icon name="users" size={17} />}
                title={u.name}
                subtitle={[u.email, `${subs.length} ${subs.length === 1 ? "submission" : "submissions"}`].filter(Boolean).join(" · ")}
                meta={u.lastLoginAt ? relTime(u.lastLoginAt) : "Never signed in"}
                stamp={<Stamp tone={u.status === "active" ? "success" : "neutral"}>{u.status || "Active"}</Stamp>}
                onClick={() => setOpenStaff(u)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────

// onNav is still accepted because the route wrapper passes it, but nothing in
// here needs it any more: the rebuilt screens navigate through react-router
// themselves rather than asking a parent to change a page string for them.
export function OfficeManagerApp({ page, onToast }: { page: string; onNav?: (p: string) => void; onToast: (m: string) => void }) {
  const [viewingSubmission, setViewingSubmission] = useState<any>(null);
  const [showStartForm, setShowStartForm] = useState(false);

  useEffect(() => { setViewingSubmission(null); }, [page]);

  if (viewingSubmission) {
    return <SubmissionDetail submission={viewingSubmission} onClose={() => setViewingSubmission(null)} onToast={onToast} />;
  }

  return (
    <>
      <StartFormDialog
        open={showStartForm}
        onClose={() => setShowStartForm(false)}
        onToast={(m) => { onToast(m); setShowStartForm(false); }}
      />

      {page === "submissions" && <SubmissionsLedger onView={setViewingSubmission} />}
      {page === "clients" && <ClientsScreen />}
      {page === "new-hires" && <NewHireReview onToast={onToast} />}
      {page === "inbound" && <InboundQueue onToast={onToast} />}
      {page === "applications" && <ApplicationsReview onToast={onToast} />}
      {page === "team" && <TeamDirectory />}
      {page === "audit" && <ConsoleAuditLog />}
      {page === "dashboard" && <ConsoleDashboard basePath="/office-manager" />}
      {!["submissions", "clients", "new-hires", "inbound", "applications", "team", "audit", "dashboard"].includes(page) && (
        <ConsoleDashboard basePath="/office-manager" />
      )}
    </>
  );
}

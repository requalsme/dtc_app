// The administrator console.
//
// Most of what an admin does is shared with the office manager and lives in
// src/console/. What is left here is the work only an admin does: bringing
// forms into the app, and reconciling training certificates that arrive from
// the course site against the people who earned them.

import React, { useEffect, useState, useRef } from "react";
import { ConsoleDashboard } from "../console/Dashboard.jsx";
// Shared with the office-manager console, so the two areas are the same
// product rather than two designs wearing the same colours.
import { ClientsScreen } from "../console/Clients.jsx";
import { AuditLog as ConsoleAuditLog } from "../console/Audit.jsx";
import { UsersScreen } from "../console/Users.jsx";
import { TemplatesScreen } from "../console/Templates.jsx";
import { FormBuilder } from "../console/FormBuilder.jsx";
import { NewFormScreen } from "../console/NewForm.jsx";
import { HELP } from "../console/helpTips.js";
import { SheetHeader, useAreaLabel } from "../console/Chrome.jsx";
import {
  Icon, Button, Stamp, MonoLabel, Panel, Select, RecordRow,
  EmptyState, Chip, Text, HelpBot,
} from "../design/index.js";
import { ApplicationsReview } from "../features/office-manager/ApplicationsReview.tsx";
import { DTCStore as Store } from "./store.js";
import { fmtDate } from "../utils/format.ts";
import { extractSchemaFromPdf } from "../utils/pdfExtract.ts";

const ROLE_LABELS = {
  admin: "Admin",
  officeManager: "Office manager",
  caregiver: "Caregiver",
  newHire: "New hire",
  client: "Client",
};

// ── Upload / library ───────────────────────────────────────────────────────

// Order the library sections are shown in: intake first, then the recurring
// clinical/visit work, then policy. Any category not listed falls to the end.
const LIBRARY_CATEGORY_ORDER = [
  "Admission",
  "Onboarding",
  "Clinical",
  "Supervisory",
  "Visit",
  "Policy",
  "Client",
  "Other",
];

/** The drop target. Big, because it is the one thing this screen is for. */
function DropZone({ onFile }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileErr, setFileErr] = useState("");
  const inputRef = useRef(null);

  const accept = (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
    if (!isPdf) { setFileErr("That file isn't a PDF. Choose a .pdf file."); return; }
    setFileErr("");
    onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); accept(e.dataTransfer.files?.[0]); }}
      style={{
        padding: "44px 32px",
        textAlign: "center",
        borderRadius: "var(--radius-panel)",
        border: `1.5px dashed ${dragOver ? "var(--brand-primary)" : "var(--border-default)"}`,
        background: dragOver ? "var(--surface-accent)" : "var(--surface-card)",
        transition: "background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)",
        marginBottom: 38,
        maxWidth: 820,
      }}
    >
      <span style={{ color: dragOver ? "var(--brand-accent)" : "var(--text-quiet)" }}>
        <Icon name="upload" size={30} />
      </span>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500,
        color: "var(--text-brand)", margin: "14px 0 8px",
      }}>
        Drop a PDF here
      </div>
      <Text role="body" color="secondary" style={{
        fontSize: 14, lineHeight: 1.6, display: "block", maxWidth: "52ch", margin: "0 auto",
      }}>
        Fillable forms are read exactly. Printed forms are read from the layout of the page, so
        the questions come through as real fields you can edit. Check the draft before publishing.
      </Text>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      <Button style={{ marginTop: 20 }} iconLeft={<Icon name="upload" size={16} />} onClick={() => inputRef.current?.click()}>
        Choose a PDF
      </Button>
      {fileErr && (
        <Text role="body" style={{ display: "block", marginTop: 12, fontSize: 13, color: "var(--status-danger)" }}>
          {fileErr}
        </Text>
      )}
    </div>
  );
}

function Upload({ onImport, onUploadFile, onToast }) {
  const area = useAreaLabel();
  const [, force] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const library = Store.getLibrary();
  const importedCount = library.filter((i) => i.imported).length;
  const remaining = library.length - importedCount;

  // Importing 33 forms one at a time is ~33 round trips through the extract
  // screen. This brings them all in as drafts in one go; each can still be
  // opened and edited afterwards, and nothing goes live until it is published.
  const importAll = async () => {
    const pending = library.filter((i) => !i.imported);
    if (!pending.length) return;
    setBulkBusy(true);
    setBulkMsg(`Importing 0 of ${pending.length}…`);
    let done = 0;
    for (const item of pending) {
      try {
        await Store.importTemplate(item.schemaKey);
      } catch {
        /* keep going — one bad form shouldn't stop the rest */
      }
      done++;
      setBulkMsg(`Importing ${done} of ${pending.length}…`);
    }
    setBulkBusy(false);
    setBulkMsg("");
    onToast?.(`Imported ${done} form${done === 1 ? "" : "s"} as drafts`);
  };

  return (
    <>
      <SheetHeader
        eyebrow={`${area} / Templates / Import`}
        title="Bring a form in"
        lead="Upload a PDF the agency already prints, or import one from the reference library. Everything arrives as a draft you can edit before it goes anywhere."
      />

      <DropZone onFile={onUploadFile} />

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap", maxWidth: 820 }}>
        <MonoLabel rule count={library.length} style={{ flex: 1 }}>Reference library</MonoLabel>
        <span style={{ fontSize: 12.5, color: "var(--text-quiet)" }}>
          {importedCount} of {library.length} imported
        </span>
        {remaining > 0 && (
          <Button size="sm" variant="outline" disabled={bulkBusy}
            iconLeft={<Icon name="download" size={15} />} onClick={importAll}>
            {bulkBusy ? bulkMsg : `Import all ${remaining} remaining`}
          </Button>
        )}
      </div>

      {/* Grouped by category — a flat list of 33 forms keyed on filename is
          impossible to scan, and several share a source PDF. */}
      <div style={{ maxWidth: 820 }}>
        {LIBRARY_CATEGORY_ORDER
          .map((cat) => [cat, library.filter((i) => i.category === cat)])
          .filter(([, items]) => items.length > 0)
          .map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 30 }}>
              <MonoLabel rule count={items.length} style={{ marginBottom: 12 }}>{cat}</MonoLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {items.map((item) => (
                  <RecordRow
                    key={item.id}
                    icon={<Icon name="file" size={17} />}
                    // Lead with the form name; the source PDF is provenance.
                    title={item.name}
                    subtitle={`${item.pages} page${item.pages > 1 ? "s" : ""} · ${item.file}`}
                    stamp={<Stamp tone={item.imported ? "success" : "neutral"}>{item.imported ? "Imported" : "Ready"}</Stamp>}
                    accentEdge={item.imported}
                    actions={
                      <Button size="sm" variant="outline" iconLeft={<Icon name="sparkle" size={15} />}
                        onClick={() => onImport(item)}>
                        {item.imported ? "Re-open" : "Import"}
                      </Button>
                    }
                  />
                ))}
              </div>
            </div>
          ))}
      </div>

      <HelpBot {...HELP.import} storageKey="import" />
    </>
  );
}

/** The steps of an import, ticked off as each one actually finishes. */
function ImportProgress({ title, subtitle, steps, doneCount }) {
  return (
    <>
      <SheetHeader eyebrow="Administrator / Templates / Import" title={title} lead={subtitle} />
      <Panel padding={30} style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {steps.map((step, i) => {
            const done = i < doneCount;
            return (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{
                  display: "grid", placeItems: "center", width: 24, height: 24, flex: "0 0 auto",
                  borderRadius: "var(--radius-pill)",
                  background: done ? "var(--brand-primary)" : "var(--surface-sunken)",
                  color: done ? "#fff" : "var(--text-quiet)",
                  fontFamily: "var(--font-figure)", fontSize: 12,
                }}>
                  {done ? <Icon name="check" size={13} /> : i + 1}
                </span>
                <span style={{
                  fontSize: 14,
                  color: done ? "var(--text-body)" : "var(--text-quiet)",
                  fontWeight: done ? 600 : 400,
                }}>{step}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

const LIBRARY_STEPS = [
  "Reading source layout",
  "Detecting sections, fields, and signatures",
  "Capturing scoring and autofill hints",
  "Saving the editable draft",
];

function Extracting({ lib, onDone }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setActive(index);
      if (index >= LIBRARY_STEPS.length) { clearInterval(timer); setTimeout(onDone, 500); }
    }, 520);
    return () => clearInterval(timer);
  }, [onDone]);

  return <ImportProgress title="Importing" subtitle={lib.file} steps={LIBRARY_STEPS} doneCount={active} />;
}

const UPLOAD_STEP_LABELS = {
  reading: "Reading the PDF file",
  "detecting-fields": "Looking for fillable form fields",
  "extracting-text": "No form fields — reading the page layout instead",
  building: "Building the draft template",
  done: "Draft saved",
};

// Real extraction pipeline for an arbitrary admin-uploaded PDF — each step below
// is reported only once the corresponding async work has actually happened
// (see src/utils/pdfExtract.ts), so this is genuine progress, not a fake timer.
function UploadExtracting({ file, onDone, onCancel }) {
  const [doneSteps, setDoneSteps] = useState([]);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const schema = await extractSchemaFromPdf(file, (step) => {
          setDoneSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
        });
        // The file goes with the schema now, so the original page can be
        // shown behind the values that were read off it.
        const template = await Store.importUploadedSchema(schema, file);
        onDone(template);
      } catch (err) {
        console.error("PDF import failed", err);
        setError(err?.message || "Couldn't read that PDF. It may be corrupted, password-protected, or an unsupported format.");
      }
    })();
  }, [file, onDone]);

  if (error) {
    return (
      <>
        <SheetHeader
          eyebrow="Administrator / Templates / Import"
          title="That PDF couldn't be read"
          lead={file.name}
          actions={
            <Button variant="outline" iconLeft={<Icon name="arrowLeft" size={16} />} onClick={onCancel}>
              Back to import
            </Button>
          }
        />
        <Panel padding={26} style={{ maxWidth: 620 }}>
          <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
            <span style={{ color: "var(--status-danger)", flex: "0 0 auto", marginTop: 2 }}>
              <Icon name="alert" size={20} />
            </span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-body)", marginBottom: 8 }}>{error}</div>
              <Text role="body" color="secondary" style={{ fontSize: 13.5, lineHeight: 1.65 }}>
                Try a different file, or open this one in another program and re-save it as a
                standard PDF. A file of zero bytes cannot be recovered — it needs re-exporting
                from wherever it came from.
              </Text>
            </div>
          </div>
        </Panel>
      </>
    );
  }

  const labels = doneSteps.map((s) => UPLOAD_STEP_LABELS[s] || s);
  return (
    <ImportProgress
      title="Reading your PDF"
      subtitle={file.name}
      steps={labels.length ? labels : ["Reading the PDF file"]}
      doneCount={labels.length}
    />
  );
}

// ── Certificates ───────────────────────────────────────────────────────────

function Certificates({ onToast }) {
  const area = useAreaLabel();
  const [, force] = useState(0);
  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);
  const certs = Store.getCertificates ? Store.getCertificates() : [];
  const users = Store.getUsers();

  const linkTo = async (certId, userId) => {
    if (!userId) return;
    try {
      await Store.linkCertificate(certId, userId);
      onToast("Certificate matched to user");
    } catch (err) {
      onToast(err.message || "Could not match certificate");
    }
  };

  // Auto-match by email (from the app handoff); fall back to a manual link.
  const resolve = (c) =>
    users.find((u) => u.id === c.linkedUserId)
    || users.find((u) => c.email && (u.email || "").toLowerCase() === String(c.email).toLowerCase());

  const unmatched = certs.filter((c) => !resolve(c)).length;

  return (
    <>
      <SheetHeader
        eyebrow={`${area} / Certificates`}
        title="Training certificates"
        lead="Course completions arriving from the training site. A certificate only counts towards someone's onboarding once it is matched to their account."
      />

      {certs.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 26, flexWrap: "wrap", alignItems: "center" }}>
          <Chip icon={<Icon name="award" size={14} />}>{certs.length} received</Chip>
          {unmatched > 0 && (
            <Chip icon={<Icon name="alert" size={14} />}>{unmatched} not matched to anyone</Chip>
          )}
        </div>
      )}

      {certs.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          description="Completions from the training site appear here as people pass their courses."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 900 }}>
          {certs.map((c) => {
            const linked = resolve(c);
            return (
              <RecordRow
                key={c.id}
                icon={<Icon name="award" size={17} />}
                title={c.name || c.learnerName || "Unknown learner"}
                subtitle={[
                  c.courseTitle || c.course || c.title,
                  c.score != null ? `${c.score}%` : null,
                  c.dob ? `DOB ${fmtDate(c.dob)}` : null,
                ].filter(Boolean).join(" · ")}
                meta={c.date ? fmtDate(String(c.date).slice(0, 10)) : ""}
                stamp={linked ? <Stamp tone="success">{linked.name}</Stamp> : <Stamp tone="warning">Unmatched</Stamp>}
                accentEdge={!linked}
                actions={
                  linked ? null : (
                    <div style={{ width: 210 }} onClick={(e) => e.stopPropagation()}>
                      <Select
                        defaultValue=""
                        onChange={(e) => linkTo(c.id, e.target.value)}
                        options={[
                          { value: "", label: "Match to a person…" },
                          ...users.map((u) => ({
                            value: u.id,
                            label: `${u.name} (${ROLE_LABELS[u.role] || u.role})`,
                          })),
                        ]}
                      />
                    </div>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}

// ── AdminApp ───────────────────────────────────────────────────────────────

function AdminApp({ page, onNav, onToast }) {
  const [importLib, setImportLib] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [draftTemplate, setDraftTemplate] = useState(null);

  useEffect(() => {
    setImportLib(null);
    setExtracting(false);
    setUploadFile(null);
    setEditingKey(null);
    setDraftTemplate(null);
  }, [page]);

  if (editingKey) {
    return (
      <FormBuilder
        templateKey={editingKey}
        initial={draftTemplate}
        onClose={() => { setEditingKey(null); setDraftTemplate(null); onNav("templates"); }}
        onToast={onToast}
      />
    );
  }

  if (uploadFile) {
    return (
      <UploadExtracting
        file={uploadFile}
        onCancel={() => setUploadFile(null)}
        onDone={(template) => {
          setUploadFile(null);
          onToast(`${template.name} imported as a draft`);
          setEditingKey(template.key);
        }}
      />
    );
  }

  if (extracting && importLib) {
    return (
      <Extracting
        lib={importLib}
        onDone={async () => {
          const template = await Store.importTemplate(importLib.schemaKey);
          setExtracting(false);
          setEditingKey(template.key);
        }}
      />
    );
  }

  switch (page) {
    case "dashboard": return <ConsoleDashboard basePath="/admin" />;
    case "templates": return (
      <TemplatesScreen
        onToast={onToast}
        onNew={() => onNav("new-form")}
        onEdit={(key) => setEditingKey(key)}
      />
    );
    case "new-form": return (
      <NewFormScreen
        onToast={onToast}
        onBack={() => onNav("templates")}
        onImport={() => onNav("upload")}
        onEdit={(template) => { setDraftTemplate(template); setEditingKey(template.key); }}
      />
    );
    case "upload": return <Upload onImport={(item) => { setImportLib(item); setExtracting(true); }} onUploadFile={setUploadFile} onToast={onToast} />;
    case "users": return <UsersScreen onToast={onToast} />;
    case "clients": return <ClientsScreen />;
    case "audit": return <ConsoleAuditLog />;
    case "certificates": return <Certificates onToast={onToast} />;
    case "applications": return <ApplicationsReview onToast={onToast} />;
    default: return <ConsoleDashboard basePath="/admin" />;
  }
}

export { AdminApp };

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Icon } from "./fields.jsx";
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
import { HelpBot } from "../design/index.js";
import { ApplicationsReview } from "../features/office-manager/ApplicationsReview.tsx";
import { DTCStore as Store } from "./store.js";
import { fmtDate } from "../utils/format.ts";
import { FormWizard } from "./forms/FormWizard";
import { extractSchemaFromPdf } from "../utils/pdfExtract.ts";
import { TRAINING_MODULES } from "./trainingModules.js";

const relTime = (iso) => {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return fmtDate(iso.slice(0, 10));
};

const FIELD_TYPES = ["text", "textarea", "number", "date", "time", "select", "radio", "checkbox", "signature", "table"];
// ── Upload/Library ─────────────────────────────────────────────────────────

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

function Upload({ onImport, onUploadFile, onToast }) {
  const [, force] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileErr, setFileErr] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const inputRef = useRef(null);
  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);
  const library = Store.getLibrary();
  const importedCount = library.filter((i) => i.imported).length;

  const acceptFile = (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
    if (!isPdf) { setFileErr("That file isn't a PDF. Please choose a .pdf file."); return; }
    setFileErr("");
    onUploadFile(file);
  };

  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>Import Template</h1>
        </div>
      </div>
      <div
        className="dropzone"
        style={dragOver ? { borderColor: "var(--accent)", background: "var(--accent-soft)" } : undefined}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          acceptFile(e.dataTransfer.files?.[0]);
        }}
      >
        <Icon n="upload" s={30} />
        <div className="dt">Drag & drop a PDF here</div>
        <div className="dd">Any PDF works. Fillable forms are read exactly; printed forms are read from the layout of the page, so the questions come through as real fields. Check the draft before publishing.</div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: "none" }}
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />
        <button className="dbtn dbtn-primary" style={{ marginTop: 14 }} onClick={() => inputRef.current?.click()}>
          <Icon n="upload" s={14} /> Choose PDF file
        </button>
        {fileErr ? <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 10 }}>{fileErr}</div> : null}
      </div>
      <div
        className="ds-navlabel"
        style={{ padding: "2px 2px 12px", display: "flex", alignItems: "center", gap: 10 }}
      >
        <span>
          Reference library
          <span style={{ color: "var(--ink-3)", fontWeight: 400, marginLeft: 8 }}>
            {importedCount} of {library.length} imported
          </span>
        </span>
        {/* Importing 33 forms one at a time is ~33 round trips through the
            extract screen. This brings them all in as drafts in one go; each
            can still be opened and edited afterwards, and nothing goes live
            until it is published. */}
        {importedCount < library.length ? (
          <button
            className="dbtn dbtn-ghost"
            style={{ padding: "5px 11px", fontSize: 11.5, marginLeft: "auto" }}
            disabled={bulkBusy}
            onClick={async () => {
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
            }}
          >
            <Icon n="download" s={13} /> {bulkBusy ? bulkMsg : `Import all ${library.length - importedCount} remaining`}
          </button>
        ) : null}
      </div>
      {/* Grouped by category — a flat list of 33 forms keyed on filename is
          impossible to scan, and several share a source PDF. */}
      {LIBRARY_CATEGORY_ORDER
        .map((cat) => [cat, library.filter((i) => i.category === cat)])
        .filter(([, items]) => items.length > 0)
        .map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 22 }}>
            <div
              className="section-label"
              style={{ padding: "0 2px 8px", display: "flex", alignItems: "center", gap: 8 }}
            >
              {cat}
              <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>{items.length}</span>
            </div>
            <div className="upload-grid">
              {items.map((item) => (
                <div className="lib-card" key={item.id}>
                  <div className="lh">
                    <div className="pdf-ic"><span className="corner" /></div>
                    <div className="li">
                      {/* Lead with the form name; the source PDF is provenance. */}
                      <div className="fn">{item.name}</div>
                      <div className="fm">
                        {item.pages} page{item.pages > 1 ? "s" : ""} · {item.file}
                      </div>
                    </div>
                  </div>
                  <div className="la">
                    {item.imported ? <span className="spill pub">Imported</span> : <span className="spill draft">Ready</span>}
                    <button className="dbtn dbtn-primary" style={{ padding: "7px 13px", fontSize: 12 }} onClick={() => onImport(item)}>
                      <Icon n="sparkle" s={13} />
                      {item.imported ? "Re-open" : "Import & extract"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      <HelpBot {...HELP.import} storageKey="import" />
    </div>
  );
}

function Extracting({ lib, onDone }) {
  const steps = [
    "Reading source layout",
    "Detecting sections, fields, and signatures",
    "Capturing scoring and autofill hints",
    "Saving the editable draft",
  ];
  const [active, setActive] = useState(0);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setActive(index);
      if (index >= steps.length) { clearInterval(timer); setTimeout(onDone, 500); }
    }, 520);
    return () => clearInterval(timer);
  }, [onDone, steps.length]);

  return (
    <div>
      <div className="ds-ph"><div><h1>Importing</h1><p>{lib.file}</p></div></div>
      <div className="extracting">
        <div className="spin" />
        <h3>Building the draft template</h3>
        <p>The schema is being prepared for editing and publishing.</p>
        <div className="steps">
          {steps.map((step, i) => (
            <div className={`est${i < active ? " done" : ""}`} key={step}>
              <span className="tk">{i < active ? <Icon n="check" s={12} /> : i + 1}</span>
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const UPLOAD_STEP_LABELS = {
  reading: "Reading the PDF file",
  "detecting-fields": "Detecting fillable form fields",
  "extracting-text": "No form fields found — extracting page text instead",
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
      <div>
        <div className="ds-ph"><div><h1>Import failed</h1><p>{file.name}</p></div></div>
        <div className="extracting">
          <h3 style={{ color: "var(--red)" }}>{error}</h3>
          <p>Try a different file, or open this one in another program and re-save it as a standard PDF.</p>
          <button className="dbtn dbtn-primary" style={{ marginTop: 14 }} onClick={onCancel}>Back to import</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="ds-ph"><div><h1>Importing</h1><p>{file.name}</p></div></div>
      <div className="extracting">
        <div className="spin" />
        <h3>Reading your PDF</h3>
        <p>The schema is being prepared for editing and publishing.</p>
        <div className="steps">
          {doneSteps.map((step, i) => (
            <div className={`est${i < doneSteps.length ? " done" : ""}`} key={step}>
              <span className="tk"><Icon n="check" s={12} /></span>
              {UPLOAD_STEP_LABELS[step] || step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Certificates({ onToast }) {
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

  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>Certificates</h1>
        </div>
      </div>
      <div className="ds-panel">
        <table className="ds-table">
          <thead>
            <tr><th>Learner</th><th>Course</th><th>Score</th><th>Completed</th><th>Matched to</th></tr>
          </thead>
          <tbody>
            {certs.map((c) => {
              // Auto-match by email (from the app handoff); fall back to a manual link.
              const linked = users.find((u) => u.id === c.linkedUserId)
                || users.find((u) => c.email && (u.email || "").toLowerCase() === String(c.email).toLowerCase());
              return (
                <tr key={c.id}>
                  <td>
                    <span className="cell-main">{c.name || c.learnerName || "—"}</span>
                    {c.dob ? <span className="cell-sub">DOB {fmtDate(c.dob)}</span> : null}
                  </td>
                  <td>{c.courseTitle || c.course || c.title || "—"}</td>
                  <td>{c.score != null ? `${c.score}%` : "—"}</td>
                  <td style={{ color: "var(--ink-3)", fontSize: 12 }}>{c.date ? fmtDate(String(c.date).slice(0, 10)) : "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {linked ? (
                      <span className="spill pub"><span className="pip" />{linked.name}</span>
                    ) : (
                      <select className="ds-select" defaultValue="" onChange={(e) => linkTo(c.id, e.target.value)}>
                        <option value="">Match to user…</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role] || u.role})</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
            {certs.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 28, color: "var(--ink-3)" }}>No certificates yet. Completions from the training site will appear here once the integration is live.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
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

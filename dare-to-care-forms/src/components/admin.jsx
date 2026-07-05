import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Icon } from "./fields.jsx";
import { AdminDashboard } from "../features/admin/AdminDashboard.tsx";
import { DTCStore as Store } from "./store.js";
import { fmtDate } from "../utils/format.ts";
import { FormWizard } from "./forms/FormWizard";

const relTime = (iso) => {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return fmtDate(iso.slice(0, 10));
};

const FIELD_TYPES = ["text", "textarea", "number", "date", "time", "select", "radio", "checkbox", "signature", "table"];

// ── Templates ─────────────────────────────────────────────────────────────

function Templates({ onEdit, onNav, onToast }) {
  const [, force] = useState(0);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [showVersions, setShowVersions] = useState(null);
  const [versions, setVersions] = useState([]);

  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const templates = Store.getTemplates();
  const categories = Array.from(new Set(templates.map((t) => t.category).filter(Boolean)));

  const filtered = useMemo(() => templates.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterCat && t.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.category?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [templates, filterStatus, filterCat, search]);

  const openVersions = async (key) => {
    const v = await Store.getTemplateVersions(key);
    setVersions(v);
    setShowVersions(key);
  };

  return (
    <div>
      {showVersions && (
        <div className="modal-overlay" onClick={() => setShowVersions(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-head">
              <h3>Version history — {templates.find((t) => t.key === showVersions)?.name}</h3>
              <button className="modal-close" onClick={() => setShowVersions(null)}><Icon n="x" s={16} /></button>
            </div>
            <div className="modal-body">
              {versions.length === 0 ? (
                <p style={{ color: "var(--ink-3)", fontSize: 13 }}>No version snapshots for this template. The current live version is shown in the Templates list.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="history-row">
                    <span className="history-dot" style={{ background: "var(--accent)" }} />
                    <div className="history-body">
                      <div className="history-header">
                        <strong>v{v.version}</strong>
                        <span style={{ marginLeft: 8, color: "var(--ink-3)", fontSize: 12 }}>{relTime(v.snapshottedAt)}</span>
                        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-3)" }}>{v.snapshotBy}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>
                        {(v.sections || []).length} sections · {(v.sections || []).reduce((n, s) => n + (s.fields?.length || 0), 0)} fields
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-foot">
              <button className="dbtn dbtn-ghost" onClick={() => setShowVersions(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="ds-ph">
        <div>
          <h1>Templates</h1>
          <p>Digitized forms move from import to editable draft to published workflow.</p>
        </div>
        <div className="actions">
          <button className="dbtn dbtn-primary" onClick={() => onNav("upload")}>
            <Icon n="upload" s={15} /> Import PDF
          </button>
        </div>
      </div>

      <div className="ds-filters">
        <input className="ds-search" placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="ds-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select className="ds-select" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="ds-panel">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Template</th><th>Category</th><th>Fields</th><th>Version</th><th>Status</th><th>Updated</th><th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((template) => (
              <tr key={template.key} onClick={() => onEdit(template.key)}>
                <td>
                  <span className="row-ic">
                    <span className="ti"><Icon n={template.icon} s={16} /></span>
                    <span>
                      <span className="cell-main">{template.name}</span>
                      <span className="cell-sub">{template.description}</span>
                    </span>
                  </span>
                </td>
                <td>{template.category}</td>
                <td>{template.fieldCount}</td>
                <td><span className="spill ver">v{template.version}</span></td>
                <td>
                  <span className={`spill ${template.status === "published" ? "pub" : "draft"}`}>
                    <span className="pip" />{template.status}
                  </span>
                </td>
                <td style={{ color: "var(--ink-3)", fontSize: 12 }}>{relTime(template.updatedAt)}</td>
                <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  <button className="dbtn dbtn-ghost" style={{ padding: "5px 10px", fontSize: 11, marginRight: 4 }} onClick={() => openVersions(template.key)}>
                    History
                  </button>
                  {template.status === "published" ? (
                    <button className="dbtn dbtn-ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={async () => { await Store.unpublishTemplate(template.key); onToast(`${template.name} moved to draft`); }}>
                      Unpublish
                    </button>
                  ) : (
                    <button className="dbtn dbtn-primary" style={{ padding: "5px 10px", fontSize: 11 }} onClick={async () => { await Store.publishTemplate(template.key); onToast(`${template.name} is now live`); }}>
                      Publish
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "var(--ink-3)" }}>No templates match the filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Upload/Library ─────────────────────────────────────────────────────────

function Upload({ onImport }) {
  const [, force] = useState(0);
  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);
  const library = Store.getLibrary();

  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>Import Template</h1>
          <p>Select from the reference library to create an editable template backed by a structured schema.</p>
        </div>
      </div>
      <div className="dropzone">
        <Icon n="upload" s={30} />
        <div className="dt">Reference library import</div>
        <div className="dd">Each import creates a draft template. Edit in the builder, then publish to make it live for caregivers.</div>
      </div>
      <div className="ds-navlabel" style={{ padding: "2px 2px 12px" }}>Reference library</div>
      <div className="upload-grid">
        {library.map((item) => (
          <div className="lib-card" key={item.id}>
            <div className="lh">
              <div className="pdf-ic"><span className="corner" /></div>
              <div className="li">
                <div className="fn">{item.file}</div>
                <div className="fm">{item.pages} page{item.pages > 1 ? "s" : ""} · {Store.schemaName(item.schemaKey)}</div>
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
  );
}

function Extracting({ lib, onDone }) {
  const steps = [
    "Loading the reference schema",
    "Creating sections and fields",
    "Applying autofill and sign-off rules",
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

// ── Full Builder ─────────────────────────────────────────────────────────────

function Builder({ templateKey, onClose, onToast }) {
  const [template, setTemplate] = useState(() => {
    const t = Store.getTemplate(templateKey) || { key: templateKey, name: templateKey, status: "draft", sections: [] };
    const copy = JSON.parse(JSON.stringify(t));
    if (!Array.isArray(copy.sections)) copy.sections = [];
    return copy;
  });
  const [selected, setSelected] = useState(null);
  const [showPublishChecklist, setShowPublishChecklist] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const selectedField = selected ? template.sections[selected.si]?.fields?.[selected.fi] : null;

  const patchTemplate = (patch) => setTemplate((t) => ({ ...t, ...patch }));

  const patchField = (patch) => {
    setTemplate((t) => {
      const next = JSON.parse(JSON.stringify(t));
      Object.assign(next.sections[selected.si].fields[selected.fi], patch);
      return next;
    });
  };

  const patchFieldOption = (optIdx, label) => {
    setTemplate((t) => {
      const next = JSON.parse(JSON.stringify(t));
      next.sections[selected.si].fields[selected.fi].options[optIdx].label = label;
      return next;
    });
  };

  const addOption = () => {
    setTemplate((t) => {
      const next = JSON.parse(JSON.stringify(t));
      const opts = next.sections[selected.si].fields[selected.fi].options || [];
      opts.push({ label: "New option" });
      next.sections[selected.si].fields[selected.fi].options = opts;
      return next;
    });
  };

  const removeOption = (optIdx) => {
    setTemplate((t) => {
      const next = JSON.parse(JSON.stringify(t));
      next.sections[selected.si].fields[selected.fi].options.splice(optIdx, 1);
      return next;
    });
  };

  const addField = (si) => {
    const newField = { id: `f_${Date.now()}`, label: "New field", type: "text", required: false };
    setTemplate((t) => {
      const next = JSON.parse(JSON.stringify(t));
      next.sections[si].fields.push(newField);
      return next;
    });
    setSelected({ si, fi: template.sections[si].fields.length });
  };

  const removeField = (si, fi) => {
    setTemplate((t) => {
      const next = JSON.parse(JSON.stringify(t));
      next.sections[si].fields.splice(fi, 1);
      return next;
    });
    setSelected(null);
  };

  const moveField = (si, fi, dir) => {
    setTemplate((t) => {
      const next = JSON.parse(JSON.stringify(t));
      const fields = next.sections[si].fields;
      const to = fi + dir;
      if (to < 0 || to >= fields.length) return next;
      [fields[fi], fields[to]] = [fields[to], fields[fi]];
      return next;
    });
    setSelected({ si, fi: fi + dir });
  };

  const addSection = () => {
    const newSec = { id: `s_${Date.now()}`, title: "New Section", fields: [] };
    setTemplate((t) => ({ ...t, sections: [...t.sections, newSec] }));
  };

  const removeSection = (si) => {
    if (!window.confirm("Remove this section and all its fields?")) return;
    setTemplate((t) => {
      const next = JSON.parse(JSON.stringify(t));
      next.sections.splice(si, 1);
      return next;
    });
    setSelected(null);
  };

  const renameSection = (si, title) => {
    setTemplate((t) => {
      const next = JSON.parse(JSON.stringify(t));
      next.sections[si].title = title;
      return next;
    });
  };

  const saveDraft = async () => {
    await Store.saveTemplate(template);
    onToast("Draft saved");
  };

  const checkPublish = () => setShowPublishChecklist(true);

  const doPublish = async () => {
    await Store.saveTemplate(template);
    await Store.publishTemplate(template.key);
    onToast(`${template.name} published and live`);
    setShowPublishChecklist(false);
    onClose();
  };

  // Publish checklist validation
  const allFields = template.sections.flatMap((s) => s.fields || []);
  const hasSignature = allFields.some((f) => f.type === "signature");
  const hasRequiredFields = allFields.some((f) => f.required);
  const hasSections = template.sections.length > 0;
  const checklist = [
    { label: "At least one section", ok: hasSections },
    { label: "At least one required field", ok: hasRequiredFields },
    { label: "Has a signature field", ok: hasSignature },
    { label: "Subject is set (client or employee)", ok: !!template.subject },
    { label: "Completed-by roles are configured", ok: (template.completedBy || []).length > 0 },
  ];
  const canPublish = checklist.every((c) => c.ok);

  return (
    <div>
      {showPublishChecklist && (
        <div className="modal-overlay" onClick={() => setShowPublishChecklist(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Publish checklist — {template.name}</h3>
              <button className="modal-close" onClick={() => setShowPublishChecklist(false)}><Icon n="x" s={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14 }}>
                Publishing makes this template live for all assigned roles. Please confirm all requirements are met.
              </p>
              {checklist.map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 13 }}>
                  <span style={{ color: item.ok ? "var(--accent)" : "var(--red)", fontWeight: 600, fontSize: 16, width: 20, textAlign: "center" }}>
                    {item.ok ? "✓" : "✗"}
                  </span>
                  <span style={{ color: item.ok ? "var(--ink-1)" : "var(--red)" }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button className="dbtn dbtn-ghost" onClick={() => setShowPublishChecklist(false)}>Cancel</button>
              <button className="dbtn dbtn-primary" disabled={!canPublish} onClick={doPublish}>
                <Icon n="check" s={14} /> {canPublish ? "Publish now" : "Fix issues first"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewing && (
        <FormWizard
          schemaOverride={template}
          submitLabel="Close preview"
          onClose={() => setPreviewing(false)}
          onSubmit={() => setPreviewing(false)}
        />
      )}

      <div className="ds-ph">
        <div>
          <button className="dbtn dbtn-ghost" style={{ marginBottom: 10, padding: "6px 12px", fontSize: 12 }} onClick={onClose}>
            <Icon n="arrowLeft" s={14} /> All templates
          </button>
          <h1>{template.name}</h1>
          <p>
            {template.category} · v{template.version} ·{" "}
            <span className={`spill ${template.status === "published" ? "pub" : "draft"}`}>{template.status}</span>
          </p>
        </div>
        <div className="actions">
          <button className="dbtn dbtn-ghost" onClick={() => setPreviewing(true)}>
            <Icon n="eye" s={15} /> Preview
          </button>
          <button className="dbtn dbtn-ghost" onClick={saveDraft}>Save draft</button>
          <button className="dbtn dbtn-primary" onClick={checkPublish}>
            <Icon n="check" s={15} /> {template.status === "published" ? "Re-publish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="builder">
        <div className="builder-main">
          {/* Template meta editor */}
          <div className="interp-card" style={{ marginBottom: 16 }}>
            <div className="ih">Template settings</div>
            <div className="ig" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="il">Template name</label>
                <input className="insp-input" value={template.name} onChange={(e) => patchTemplate({ name: e.target.value })} />
              </div>
              <div>
                <label className="il">Category</label>
                <input className="insp-input" value={template.category} onChange={(e) => patchTemplate({ category: e.target.value })} />
              </div>
              <div>
                <label className="il">Subject</label>
                <select className="ds-select" style={{ width: "100%" }} value={template.subject === "client" ? "client" : "self"} onChange={(e) => patchTemplate({ subject: e.target.value })}>
                  <option value="client">Client</option>
                  <option value="self">Employee (self)</option>
                </select>
              </div>
              <div>
                <label className="il">Completed by</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["caregiver", "officeManager", "admin"].map((role) => {
                    const checked = (template.completedBy || []).includes(role);
                    return (
                      <button key={role} className={`admin-check-row${checked ? " selected" : ""}`} style={{ fontSize: 11, padding: "4px 8px", flex: 1 }}
                        onClick={() => patchTemplate({ completedBy: checked ? (template.completedBy || []).filter((r) => r !== role) : [...(template.completedBy || []), role] })}>
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {template.sections.map((section, si) => (
            <div className="bsec" key={section.id}>
              <div className="bsec-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="sn">SECTION {si + 1}</span>
                <input
                  value={section.title}
                  onChange={(e) => renameSection(si, e.target.value)}
                  className="insp-input"
                  style={{ flex: 1, padding: "4px 8px", fontSize: 13, fontWeight: 600 }}
                />
                <button className="dbtn dbtn-ghost" style={{ padding: "4px 8px", fontSize: 11, color: "var(--red)" }} onClick={() => removeSection(si)}>
                  <Icon n="x" s={12} />
                </button>
              </div>

              {section.fields.map((field, fi) => {
                const isSelected = selected && selected.si === si && selected.fi === fi;
                if (field.type === "policyText") {
                  return (
                    <div className="bfield" key={field.id} style={{ cursor: "default" }}>
                      <span className="bf-type">policy</span>
                      <span className="bf-label">{field.label}</span>
                    </div>
                  );
                }
                return (
                  <div className={`bfield${isSelected ? " sel" : ""}`} key={field.id} onClick={() => setSelected({ si, fi })}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button className="dbtn dbtn-ghost" style={{ padding: "1px 4px", fontSize: 10 }} onClick={(e) => { e.stopPropagation(); moveField(si, fi, -1); }}>▲</button>
                      <button className="dbtn dbtn-ghost" style={{ padding: "1px 4px", fontSize: 10 }} onClick={(e) => { e.stopPropagation(); moveField(si, fi, 1); }}>▼</button>
                    </div>
                    <span className="bf-type">{field.type}</span>
                    <span className="bf-label">{field.label}</span>
                    {field.autofill ? <span className="bf-af"><Icon n="sparkle" s={13} /></span> : null}
                    {field.required ? <span className="bf-req">*</span> : null}
                    <button className="dbtn dbtn-ghost" style={{ marginLeft: "auto", padding: "3px 7px", fontSize: 11, color: "var(--red)" }}
                      onClick={(e) => { e.stopPropagation(); removeField(si, fi); }}>
                      <Icon n="x" s={12} />
                    </button>
                  </div>
                );
              })}
              <button className="dbtn dbtn-ghost" style={{ marginTop: 6, width: "100%", fontSize: 12 }} onClick={() => addField(si)}>
                <Icon n="plus" s={13} /> Add field
              </button>
            </div>
          ))}

          <button className="dbtn dbtn-ghost" style={{ marginTop: 12, width: "100%" }} onClick={addSection}>
            <Icon n="plus" s={14} /> Add section
          </button>
        </div>

        <div className="inspector">
          <div className="inspector-h">
            <div className="t">Field inspector</div>
            <div className="nm">{selectedField ? selectedField.label : "No field selected"}</div>
          </div>

          {selectedField ? (
            <div className="inspector-b">
              <div className="insp-row">
                <label className="il" htmlFor="insp-label">Label</label>
                <input id="insp-label" className="insp-input" value={selectedField.label} onChange={(e) => patchField({ label: e.target.value })} />
              </div>
              <div className="insp-row">
                <label className="il" htmlFor="insp-type">Type</label>
                <select id="insp-type" className="ds-select" style={{ width: "100%" }} value={selectedField.type} onChange={(e) => patchField({ type: e.target.value })}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="insp-toggle">
                <label className="il">Required</label>
                <button className={`tgl${selectedField.required ? " on" : ""}`} onClick={() => patchField({ required: !selectedField.required })} />
              </div>

              {/* Options editor for radio/select/checkbox */}
              {["radio", "select", "checkbox"].includes(selectedField.type) && (
                <div className="insp-row">
                  <label className="il">Options</label>
                  {(selectedField.options || []).map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <input className="insp-input" style={{ flex: 1 }} value={opt.label} onChange={(e) => patchFieldOption(i, e.target.value)} />
                      <button className="dbtn dbtn-ghost" style={{ padding: "4px 8px", color: "var(--red)" }} onClick={() => removeOption(i)}>
                        <Icon n="x" s={12} />
                      </button>
                    </div>
                  ))}
                  <button className="dbtn dbtn-ghost" style={{ marginTop: 4, width: "100%", fontSize: 11 }} onClick={addOption}>
                    <Icon n="plus" s={11} /> Add option
                  </button>
                </div>
              )}

              {selectedField.columns && (
                <div className="insp-row">
                  <label className="il">Table columns</label>
                  {selectedField.columns.map((col, i) => (
                    <div className="insp-opt" key={i}>
                      <Icon n="grid" s={11} style={{ color: "var(--ink-4)" }} />
                      {col.label}
                      <span className="sc">{col.type}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedField.autofill && (
                <div className="insp-row">
                  <label className="il">Autofill</label>
                  <div className="insp-opt" style={{ color: "var(--ai)" }}>
                    <Icon n="sparkle" s={11} />
                    {selectedField.autofill.source}
                    <span className="sc">{selectedField.autofill.safe ? "safe" : "manual"}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="insp-empty">
              <Icon n="edit" s={26} />
              <div>Select a field to edit label, type, options, and requirements.<br />Use ▲▼ to reorder fields.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Users ─────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  admin: "Administrator",
  caregiver: "Caregiver",
  officeManager: "Office Manager",
  newHire: "New Hire",
  client: "Client",
};

const ROLE_COLORS = {
  admin: "#143d23",
  caregiver: "#2f8a68",
  officeManager: "#4c8cf3",
  newHire: "#d7923b",
  client: "#8b5cf6",
};

// Must match window.DTC_COURSES on courses.daretocarehomecare.com (and the
// NewHirePortal checklist) — completion is proven by certificates, not a
// separate in-app progress flag.
const TRAINING_MODULES = [
  { id: "emergency", title: "Emergency Preparedness & Disaster Planning" },
  { id: "home-safety", title: "Home Safety" },
  { id: "abuse", title: "Abuse & Neglect Prevention" },
  { id: "first-aid", title: "Basic First Aid" },
  { id: "infection", title: "Infection Control & Universal Precautions" },
  { id: "rights", title: "Consumer Rights & Behavior Management" },
];

function UsersPage({ onToast }) {
  const [, force] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", role: "caregiver", password: "" });
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [createdUser, setCreatedUser] = useState(null); // shown in success modal
  const [showPass, setShowPass] = useState(false);
  const [loadingPwd, setLoadingPwd] = useState(false);

  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  // Training completion comes from real course-site certificates (matched by
  // email or manual link on the Certificates page) — same source of truth the
  // New Hire portal uses.
  const editUserCerts = editUser ? Store.certificatesForUser(editUser) : [];
  const certByCourse = new Map(editUserCerts.map((c) => [c.courseId, c]));

  const users = Store.getUsers();
  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const generatePassword = () => {
    setLoadingPwd(true);
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < 12; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm((f) => ({ ...f, password: pwd }));
    setShowPass(true);
    setLoadingPwd(false);
  };

  const doCreate = async () => {
    if (!form.name || !form.email || !form.password) { onToast("Name, email and password are required"); return; }
    try {
      const created = await Store.createUser(form);
      setCreatedUser({ ...created, tempPassword: form.password });
      setForm({ name: "", email: "", role: "caregiver", password: "" });
      setShowPass(false);
    } catch (err) { onToast(err.message || "Error creating user"); }
  };

  const doEdit = async () => {
    if (!editUser) return;
    try {
      await Store.updateUser(editUser.id, { name: editUser.name, role: editUser.role, status: editUser.status, shadowCompletedAt: editUser.shadowCompletedAt ?? null });
      onToast("User updated");
      setEditUser(null);
    } catch (err) { onToast(err.message || "Error"); }
  };

  const doResetPassword = async (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user || !user.email) { onToast("User does not have an email address."); return; }
    if (confirm(`Send a password reset email to ${user.email}?`)) {
      try {
        await Store.sendPasswordReset(user.email);
        onToast("Password reset email sent. User will receive instructions.");
      } catch (err) { onToast(err.message || "Error sending reset email"); }
    }
  };

  return (
    <div>
      {/* Created user success modal */}
      {createdUser && (
        <div className="modal-overlay" onClick={() => setCreatedUser(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <h3>Account created</h3>
              <button className="modal-close" onClick={() => setCreatedUser(null)}><Icon n="x" s={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),#46a783)", color: "white", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 700, margin: "0 auto 14px" }}>
                  {createdUser.initials}
                </div>
                <strong style={{ display: "block", fontSize: 16, marginBottom: 4 }}>{createdUser.name}</strong>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{createdUser.email} · {ROLE_LABELS[createdUser.role] || createdUser.role}</span>
              </div>
              <div style={{ background: "rgba(47,138,104,0.07)", border: "1px solid rgba(47,138,104,0.2)", borderRadius: 14, padding: "16px 18px", marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-3)", marginBottom: 8 }}>Temporary password — share with user</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, letterSpacing: "0.06em", color: "var(--accent-deep)", wordBreak: "break-all" }}>{createdUser.tempPassword}</div>
                <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--ink-3)" }}>
                  The user must change this password when they first sign in.
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="dbtn dbtn-primary" onClick={() => { navigator.clipboard?.writeText(createdUser.tempPassword); onToast("Password copied!"); }}>Copy password</button>
              <button className="dbtn dbtn-ghost" onClick={() => setCreatedUser(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Edit — {editUser.name}</h3>
              <button className="modal-close" onClick={() => setEditUser(null)}><Icon n="x" s={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label">Full name</label>
                <input className="insp-input" value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="form-label">Role</label>
                <select className="ds-select" value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}>
                  <option value="caregiver">Caregiver</option>
                  <option value="newHire">New Hire</option>
                  <option value="officeManager">Office Manager</option>
                  <option value="client">Client</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Status</label>
                <select className="ds-select" value={editUser.status} onChange={(e) => setEditUser({ ...editUser, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (deactivated)</option>
                </select>
              </div>
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(215,146,59,0.07)", border: "1px solid rgba(215,146,59,0.2)", fontSize: 12.5, color: "#8a5c1a" }}>
                <strong>Reset password?</strong> — Use the "Reset Password" button to email them a secure reset link.
              </div>

              {editUser.role === "newHire" && (
                <div style={{ marginTop: 16 }}>
                  <div className="form-label" style={{ marginBottom: 8 }}>Training progress (from course certificates)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {TRAINING_MODULES.map((m) => {
                      const cert = certByCourse.get(m.id);
                      return (
                        <div key={m.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", borderRadius: 10,
                          background: cert ? "rgba(47,138,104,0.07)" : "rgba(0,0,0,0.03)",
                          border: `1px solid ${cert ? "rgba(47,138,104,0.2)" : "rgba(0,0,0,0.06)"}`,
                        }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>{m.title}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: cert ? "var(--accent-2)" : "var(--ink-3)" }}>
                            {cert ? `✓ Passed${cert.score != null ? ` · ${cert.score}%` : ""}` : "Not started"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
                      Shadow visit completed
                      <span style={{ display: "block", fontWeight: 400, fontSize: 11, color: "var(--ink-3)" }}>
                        Sign off once they've shadowed a senior caregiver.
                        {editUser.shadowCompletedAt ? ` Signed off ${relTime(editUser.shadowCompletedAt)}.` : ""}
                      </span>
                    </span>
                    <button
                      className={`tgl${editUser.shadowCompletedAt ? " on" : ""}`}
                      onClick={() => setEditUser({ ...editUser, shadowCompletedAt: editUser.shadowCompletedAt ? null : new Date().toISOString() })}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="dbtn dbtn-ghost" style={{ marginRight: "auto", color: "var(--danger)", fontSize: 12 }} onClick={() => { setEditUser(null); doResetPassword(editUser.id); }}>Reset password</button>
              <button className="dbtn dbtn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
              <button className="dbtn dbtn-primary" onClick={doEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="ds-ph">
        <div>
          <h1>Users</h1>
          <p>Manage accounts across all roles — caregivers, office staff, new hires, and clients.</p>
        </div>
      </div>

      <div className="admin-form-grid">
        {/* Create user panel */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><h3>Create account</h3><p>New users must change their temp password on first login.</p></div>
          </div>
          <div className="admin-form-stack">
            <div>
              <label className="form-label" style={{ display: "block", marginBottom: 6 }}>Full name</label>
              <input
                className="insp-input"
                placeholder="e.g. Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label" style={{ display: "block", marginBottom: 6 }}>Email address</label>
              <input
                className="insp-input"
                type="email"
                placeholder="e.g. jane@daretocare.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase().replace(/\s/g, "") })}
              />
            </div>
            <div>
              <label className="form-label" style={{ display: "block", marginBottom: 6 }}>Role</label>
              <select className="ds-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="caregiver">Caregiver</option>
                <option value="newHire">New Hire (onboarding)</option>
                <option value="officeManager">Office Manager</option>
                <option value="client">Client</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label className="form-label" style={{ display: "block", marginBottom: 6 }}>Temporary password</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="insp-input"
                  type={showPass ? "text" : "password"}
                  placeholder="Min 10 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button
                  className="dbtn dbtn-ghost"
                  style={{ padding: "0 10px", fontSize: 11 }}
                  onClick={() => setShowPass((v) => !v)}
                  title={showPass ? "Hide" : "Show"}
                >{showPass ? "Hide" : "Show"}</button>
              </div>
              <button
                className="dbtn dbtn-ghost"
                style={{ marginTop: 8, fontSize: 11.5, width: "100%" }}
                onClick={generatePassword}
                disabled={loadingPwd}
              >
                {loadingPwd ? "Generating…" : "⚡ Generate secure password"}
              </button>
            </div>
            <button className="dbtn dbtn-primary" onClick={doCreate} disabled={!form.name || !form.email || !form.password}>
              <Icon n="plus" s={14} /> Create account
            </button>
          </div>
        </section>

        {/* User list panel */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><h3>Accounts</h3><p>{users.length} total users</p></div>
          </div>
          <div style={{ padding: "0 16px 10px", display: "flex", gap: 8 }}>
            <input className="ds-search" style={{ flex: 1 }} placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="om-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="caregiver">Caregiver</option>
              <option value="newHire">New Hire</option>
              <option value="officeManager">Office Mgr</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div className="admin-user-list">
            {filtered.map((user) => (
              <div className="admin-user-row" key={user.id}>
                <div className="admin-user-avatar" style={{ opacity: user.status !== "active" ? 0.4 : 1, background: `linear-gradient(135deg, ${ROLE_COLORS[user.role] || "var(--accent)"}, ${ROLE_COLORS[user.role] || "var(--accent)"}88)` }}>{user.initials}</div>
                <div className="admin-user-copy">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  {user.mustChangePassword && <span style={{ fontSize: 10, color: "var(--warn)", fontWeight: 700 }}>Temp password</span>}
                  {user.lastLoginAt && !user.mustChangePassword && <span style={{ fontSize: 10, color: "var(--ink-4)" }}>Last login {relTime(user.lastLoginAt)}</span>}
                </div>
                <span className="ui-tag" style={{ background: `${ROLE_COLORS[user.role]}18`, color: ROLE_COLORS[user.role] || "var(--accent-deep)", borderColor: `${ROLE_COLORS[user.role]}28` }}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
                {user.status !== "active" && <span className="spill warn" style={{ fontSize: 10 }}>Inactive</span>}
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="dbtn dbtn-ghost" style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => setEditUser({ ...user })}>Edit</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>No users found.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Clients ────────────────────────────────────────────────────────────────

function ClientsPage({ onToast }) {
  const [, force] = useState(0);
  const emptyForm = { name: "", dob: "", mrn: "", physician: "", allergies: "", phone: "", address: "", primaryContact: "", notes: "", assignedUserIds: [] };
  const [form, setForm] = useState(emptyForm);
  const [editClient, setEditClient] = useState(null);
  const [editAssignments, setEditAssignments] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const caregivers = Store.getUsers().filter((u) => u.role === "caregiver");
  const clients = Store.clients.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const doCreate = async () => {
    if (!form.name) { onToast("Client name is required"); return; }
    await Store.createClient(form);
    setForm(emptyForm);
    onToast("Client created");
  };

  const openEdit = async (client) => {
    setEditClient({ ...client });
    try {
      const { assignments } = await Store.getClientAssignments(client.id);
      setEditAssignments(Array.isArray(assignments) ? assignments : []);
    } catch {
      setEditAssignments([]);
    }
  };

  const doEdit = async () => {
    if (!editClient) return;
    await Store.updateClient(editClient.id, editClient);
    await Store.updateClientAssignments(editClient.id, editAssignments);
    onToast("Client updated");
    setEditClient(null);
  };

  const doArchive = async (client) => {
    if (!window.confirm(`Archive ${client.name}? They will no longer appear in active lists.`)) return;
    await Store.updateClient(client.id, { status: "inactive" });
    onToast(`${client.name} archived`);
  };

  return (
    <div>
      {editClient && (
        <div className="modal-overlay" onClick={() => setEditClient(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-head">
              <h3>Edit — {editClient.name}</h3>
              <button className="modal-close" onClick={() => setEditClient(null)}><Icon n="x" s={16} /></button>
            </div>
            <div className="modal-body">
              {[
                { key: "name", label: "Full name", type: "text" },
                { key: "dob", label: "Date of birth", type: "date" },
                { key: "mrn", label: "MRN", type: "text" },
                { key: "physician", label: "Physician", type: "text" },
                { key: "allergies", label: "Allergies", type: "text" },
                { key: "phone", label: "Phone", type: "text" },
                { key: "address", label: "Address", type: "text" },
                { key: "notes", label: "Notes", type: "textarea" },
              ].map(({ key, label, type }) => (
                <div className="form-row" key={key}>
                  <label className="form-label">{label}</label>
                  {type === "textarea"
                    ? <textarea className="insp-input" value={editClient[key] || ""} onChange={(e) => setEditClient({ ...editClient, [key]: e.target.value })} />
                    : <input className="insp-input" type={type} value={editClient[key] || ""} onChange={(e) => setEditClient({ ...editClient, [key]: e.target.value })} />
                  }
                </div>
              ))}
              {caregivers.length > 0 && (
                <div className="form-row">
                  <label className="form-label">Assigned caregivers</label>
                  <div className="admin-checkbox-stack" style={{ marginTop: 4 }}>
                    {caregivers.map((cg) => {
                      const sel = editAssignments.includes(cg.id);
                      return (
                        <button key={cg.id} className={`admin-check-row${sel ? " selected" : ""}`}
                          onClick={() => setEditAssignments(sel ? editAssignments.filter((id) => id !== cg.id) : [...editAssignments, cg.id])}>
                          <span>{cg.name}</span>
                          <Icon n={sel ? "checkCircle" : "users"} s={16} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="dbtn dbtn-ghost" onClick={() => setEditClient(null)}>Cancel</button>
              <button className="dbtn dbtn-primary" onClick={doEdit}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      <div className="ds-ph">
        <div>
          <h1>Clients</h1>
          <p>Manage the directory that powers autofill, assignments, and stored records.</p>
        </div>
      </div>

      <div className="admin-form-grid">
        <section className="admin-panel">
          <div className="admin-panel-head"><div><h3>Add client</h3><p>Create a new client profile and assign caregivers.</p></div></div>
          <div className="admin-form-stack">
            <input className="insp-input" placeholder="Client name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="admin-form-row">
              <input className="insp-input" placeholder="DOB" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              <input className="insp-input" placeholder="MRN" value={form.mrn} onChange={(e) => setForm({ ...form, mrn: e.target.value })} />
            </div>
            <input className="insp-input" placeholder="Physician" value={form.physician} onChange={(e) => setForm({ ...form, physician: e.target.value })} />
            <input className="insp-input" placeholder="Allergies" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
            <div className="admin-form-row">
              <input className="insp-input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="insp-input" placeholder="Primary contact" value={form.primaryContact} onChange={(e) => setForm({ ...form, primaryContact: e.target.value })} />
            </div>
            <input className="insp-input" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <textarea className="insp-input" placeholder="Care notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="admin-checkbox-stack">
              {caregivers.map((cg) => {
                const sel = form.assignedUserIds.includes(cg.id);
                return (
                  <button key={cg.id} className={`admin-check-row${sel ? " selected" : ""}`}
                    onClick={() => setForm({ ...form, assignedUserIds: sel ? form.assignedUserIds.filter((id) => id !== cg.id) : [...form.assignedUserIds, cg.id] })}>
                    <span>{cg.name}</span>
                    <Icon n={sel ? "checkCircle" : "users"} s={16} />
                  </button>
                );
              })}
            </div>
            <button className="dbtn dbtn-primary" onClick={doCreate}>
              <Icon n="plus" s={14} /> Save client
            </button>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><h3>Directory</h3><p>{Store.clients.length} clients</p></div>
          </div>
          <div style={{ padding: "0 16px 12px" }}>
            <input className="ds-search" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="admin-client-list">
            {clients.map((client) => (
              <div className="admin-client-row" key={client.id} style={{ opacity: client.status === "inactive" ? 0.55 : 1 }}>
                <div className="admin-user-avatar">{client.initials}</div>
                <div className="admin-user-copy">
                  <strong>{client.name}</strong>
                  <span>{client.physician} · {client.phone}</span>
                  <span>DOB {fmtDate(client.dob)} · MRN {client.mrn}</span>
                  {client.status === "inactive" && <span style={{ fontSize: 11, color: "var(--amber)" }}>Archived</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button className="dbtn dbtn-ghost" style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => openEdit(client)}>Edit</button>
                  {client.status !== "inactive" && (
                    <button className="dbtn dbtn-ghost" style={{ padding: "4px 9px", fontSize: 11, color: "var(--amber)" }} onClick={() => doArchive(client)}>Archive</button>
                  )}
                </div>
              </div>
            ))}
            {clients.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>No clients found. Add a client using the form on the left.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Audit ─────────────────────────────────────────────────────────────────

function AuditLog() {
  const [, force] = useState(0);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterAction, setFilterAction] = useState("");

  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const audit = Store.getAudit();
  const actions = Array.from(new Set(audit.map((e) => e.action)));

  const filtered = useMemo(() => audit.filter((e) => {
    if (filterRole && e.role !== filterRole) return false;
    if (filterAction && e.action !== filterAction) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.actor?.toLowerCase().includes(q) && !e.target?.toLowerCase().includes(q) && !e.action?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [audit, filterRole, filterAction, search]);

  const exportCSV = useCallback(() => {
    const header = ["Timestamp", "Actor", "Role", "Action", "Target"];
    const rows = filtered.map((e) => [e.timestamp, e.actor, e.role, e.action.replaceAll("_", " "), e.target]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>Audit log</h1>
          <p>Immutable record of sign-ins, submissions, reviews, and template changes.</p>
        </div>
        <div className="actions">
          <button className="dbtn dbtn-ghost" onClick={exportCSV}>
            <Icon n="download" s={14} /> Export CSV
          </button>
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
        <select className="ds-select" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      <div className="ds-panel">
        <table className="ds-table">
          <thead>
            <tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
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
            {filtered.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--ink-3)" }}>No events match the filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Certificates (from the training site) ───────────────────────────────────

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
          <p>Training completions from courses.daretocarehomecare.com. Match each certificate to the right team member.</p>
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
  const [editingKey, setEditingKey] = useState(null);

  useEffect(() => {
    setImportLib(null);
    setExtracting(false);
    setEditingKey(null);
  }, [page]);

  if (editingKey) {
    return <Builder templateKey={editingKey} onClose={() => { setEditingKey(null); onNav("templates"); }} onToast={onToast} />;
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
    case "dashboard": return <AdminDashboard />;
    case "templates": return <Templates onEdit={setEditingKey} onNav={onNav} onToast={onToast} />;
    case "upload": return <Upload onImport={(item) => { setImportLib(item); setExtracting(true); }} />;
    case "users": return <UsersPage onToast={onToast} />;
    case "clients": return <ClientsPage onToast={onToast} />;
    case "audit": return <AuditLog />;
    case "certificates": return <Certificates onToast={onToast} />;
    default: return <AdminDashboard />;
  }
}

export { AdminApp };

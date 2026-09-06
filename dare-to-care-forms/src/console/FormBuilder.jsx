// Author a form — the other half of importing one.
//
// WHY THIS EXISTS
// Until now a template could only come into the app two ways: import a PDF, or
// clone one of the fixed reference schemas. Both start from something that
// already exists on paper. There was no way to make a form the agency had
// never printed, and no first-class way to reach the editor at all — you got
// there by clicking an existing template and discovering it was editable.
//
// So this is a form designer, not an edit screen bolted onto a list. It opens
// on a blank form as readily as on an imported one, and the two converge: an
// imported PDF lands here as a draft whose fields were read off the page, and
// from that point it is edited exactly like a form typed from nothing.
//
// HOW IT IS LAID OUT
// The form is the canvas, and it reads top to bottom the way the finished
// thing will. Selecting a field opens its settings beside it rather than in a
// modal, so the effect of a change is visible while it is being made — a modal
// would cover the one thing you are trying to judge. With nothing selected,
// that same column holds the form's own settings, which keeps the two levels
// of editing in one predictable place instead of two competing panels.

import React from "react";
import {
  Icon, Button, IconButton, Stamp, MonoLabel, Input, Select, Textarea,
  Checkbox, Switch, Panel, EmptyState, Chip, Dialog, SignaturePad, Text, HelpBot,
} from "../design/index.js";
import { SheetHeader, useAreaLabel } from "./Chrome.jsx";
import { useStore } from "./useStore.js";
import { HELP } from "./helpTips.js";

// The palette. `type` is what the renderer in components/fields.jsx switches
// on, so this list is the contract between the builder and the filling screen
// — a type invented here would render as a plain text box and quietly lie
// about what it collects.
const FIELD_TYPES = [
  { type: "text", label: "Short text", icon: "edit", hint: "A name, a room number, a short answer." },
  { type: "textarea", label: "Long text", icon: "list", hint: "Notes, instructions, anything that runs on." },
  { type: "date", label: "Date", icon: "calendar", hint: "A date picker." },
  { type: "time", label: "Time", icon: "clock", hint: "Clock in, clock out." },
  { type: "number", label: "Number", icon: "scale", hint: "Hours, amounts, totals." },
  { type: "tel", label: "Phone", icon: "idCard", hint: "Opens a phone keypad on a mobile." },
  { type: "email", label: "Email", icon: "send", hint: "Checks the address looks like one." },
  { type: "radio", label: "Choose one", icon: "checkCircle", hint: "One answer from a list." },
  { type: "checkbox", label: "Choose many", icon: "check", hint: "Any number of answers." },
  { type: "select", label: "Dropdown", icon: "chevDown", hint: "One answer, from a long list." },
  { type: "signature", label: "Signature", icon: "signature", hint: "Drawn and stamped onto the record." },
  { type: "policyText", label: "Text to read", icon: "fileText", hint: "Wording to read, with nothing to fill in." },
];

const TYPE_META = Object.fromEntries(FIELD_TYPES.map((t) => [t.type, t]));
const NEEDS_OPTIONS = new Set(["radio", "checkbox", "select"]);

const CATEGORIES = ["Client care", "Employee", "Compliance", "Onboarding", "Incident", "Custom"];
const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "officeManager", label: "Office manager" },
  { value: "caregiver", label: "Caregiver" },
  { value: "client", label: "Client" },
];

const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Is this form ready to be published?
 *
 * Publishing is the moment a template stops being someone's draft and starts
 * being the form the agency sends to real people, so this is the last place a
 * mistake is cheap. Each entry is `{ label, ok, blocking }` — a blocking item
 * that fails prevents publishing outright, while a non-blocking one is shown
 * as advice and can be published past.
 */
function publishChecklist(template) {
  const fields = (template.sections || []).flatMap((s) => s.fields || []);
  const fillable = fields.filter((f) => f.type !== "policyText");
  const optionFields = fillable.filter((f) => NEEDS_OPTIONS.has(f.type));

  const items = [
    {
      label: "The form has a name",
      ok: !!(template.name || "").trim() && template.name !== "Untitled form",
      blocking: true,
    },
    {
      label: "At least one field to fill in",
      ok: fillable.length > 0,
      blocking: true,
    },
    {
      label: "Every choice field has options",
      ok: optionFields.every((f) => (f.options || []).length >= 2),
      blocking: true,
    },
    {
      label: "Someone is assigned to complete it",
      ok: (template.completedBy || []).length > 0,
      blocking: true,
    },
  ];

  // TODO(human): add the advisory (non-blocking) checks.
  //
  // These are the "are you sure?" items — things that are usually a mistake but
  // are legitimately absent on some real forms, so they must NOT block. Push
  // entries of the shape { label, ok, blocking: false } onto `items`.
  //
  // Variables in scope: `template`, `fields` (everything, including read-only
  // text), `fillable` (everything a person actually answers), `optionFields`.

  return items;
}

/** One row in the canvas: a field as it will be asked. */
function FieldRow({ field, selected, onSelect, onMove, onRemove, first, last }) {
  const meta = TYPE_META[field.type] || TYPE_META.text;
  const isText = field.type === "policyText";

  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex", gap: 12, alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        background: selected ? "var(--state-selected-bg)" : "var(--surface-card)",
        boxShadow: selected
          ? "inset 0 0 0 1.5px var(--brand-primary)"
          : "inset 0 0 0 1px var(--border-hair)",
        cursor: "pointer",
        transition: "box-shadow var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)",
      }}
    >
      <span style={{
        display: "grid", placeItems: "center", width: 30, height: 30, flex: "0 0 auto",
        borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", color: "var(--text-secondary)",
      }}>
        <Icon name={meta.icon} size={16} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-body)" }}>
            {field.label || <em style={{ color: "var(--text-quiet)" }}>Untitled field</em>}
          </span>
          {field.required && <Stamp tone="warning" leaf={false}>Required</Stamp>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-quiet)", marginTop: 3 }}>
          {isText ? "Read-only text" : meta.label}
          {NEEDS_OPTIONS.has(field.type) && ` · ${(field.options || []).length} options`}
          {field.rect && " · positioned on the page"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, flex: "0 0 auto" }} onClick={(e) => e.stopPropagation()}>
        <IconButton icon={<Icon name="chevron" size={14} style={{ transform: "rotate(-90deg)" }} />}
          label="Move up" size="sm" disabled={first} onClick={() => onMove(-1)} />
        <IconButton icon={<Icon name="chevron" size={14} style={{ transform: "rotate(90deg)" }} />}
          label="Move down" size="sm" disabled={last} onClick={() => onMove(1)} />
        <IconButton icon={<Icon name="trash" size={14} />} label="Remove field" size="sm" onClick={onRemove} />
      </div>
    </div>
  );
}

/** The settings for whichever field is selected. */
function FieldInspector({ field, onPatch, onClose }) {
  const meta = TYPE_META[field.type] || TYPE_META.text;
  const options = field.options || [];

  const setOption = (i, label) => {
    const next = options.slice();
    next[i] = { ...next[i], label };
    onPatch({ options: next });
  };

  return (
    <Panel label="Field" labelRight={<IconButton icon={<Icon name="x" size={14} />} label="Close" size="sm" onClick={onClose} />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input
          label="Question"
          value={field.label || ""}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder="What is being asked?"
        />

        <Select
          label="Answer type"
          value={field.type}
          hint={meta.hint}
          onChange={(e) => {
            const type = e.target.value;
            const patch = { type };
            // Moving into a choice type with nothing to choose from produces a
            // question that cannot be answered, so seed it.
            if (NEEDS_OPTIONS.has(type) && options.length < 2) {
              patch.options = [{ label: "Yes" }, { label: "No" }];
            }
            onPatch(patch);
          }}
          options={FIELD_TYPES.map((t) => ({ value: t.type, label: t.label }))}
        />

        {field.type === "policyText" ? (
          <Textarea
            label="Wording"
            rows={6}
            value={field.body || ""}
            onChange={(e) => onPatch({ body: e.target.value })}
            hint="Shown to the person filling the form. Nothing is collected."
          />
        ) : (
          <>
            <Input
              label="Hint"
              value={field.placeholder || ""}
              onChange={(e) => onPatch({ placeholder: e.target.value })}
              hint="Optional. Appears inside the empty box."
            />
            <Switch
              label="Required"
              description="The form cannot be submitted without it."
              checked={!!field.required}
              onChange={(v) => onPatch({ required: typeof v === "boolean" ? v : v?.target?.checked })}
            />
          </>
        )}

        {NEEDS_OPTIONS.has(field.type) && (
          <div>
            <MonoLabel rule count={options.length} style={{ marginBottom: 10 }}>Options</MonoLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {options.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Input
                    value={o.label || ""}
                    onChange={(e) => setOption(i, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <IconButton
                    icon={<Icon name="trash" size={14} />}
                    label="Remove option"
                    size="sm"
                    disabled={options.length <= 2}
                    onClick={() => onPatch({ options: options.filter((_, j) => j !== i) })}
                  />
                </div>
              ))}
            </div>
            <Button size="sm" variant="ghost" iconLeft={<Icon name="plus" size={14} />}
              style={{ marginTop: 10 }}
              onClick={() => onPatch({ options: [...options, { label: `Option ${options.length + 1}` }] })}>
              Add option
            </Button>
          </div>
        )}

        {field.rect && (
          <div style={{ fontSize: 12.5, color: "var(--text-quiet)", lineHeight: 1.6 }}>
            This field was read off the original page and knows where it sits, so
            its answer can be printed back onto the real document.
          </div>
        )}
      </div>
    </Panel>
  );
}

/** The form's own settings, shown when no field is selected. */
function FormInspector({ template, onPatch }) {
  const roles = template.completedBy || [];
  const toggleRole = (value) =>
    onPatch({ completedBy: roles.includes(value) ? roles.filter((r) => r !== value) : [...roles, value] });

  return (
    <Panel label="This form">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label="Name" value={template.name || ""} onChange={(e) => onPatch({ name: e.target.value })} />
        <Textarea label="Description" rows={3} value={template.description || ""}
          onChange={(e) => onPatch({ description: e.target.value })}
          hint="Shown in the list, so somebody can tell this form from the others." />
        <Select label="Category" value={template.category || "Custom"}
          onChange={(e) => onPatch({ category: e.target.value })}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <Select label="This form is about" value={template.subject || "client"}
          onChange={(e) => onPatch({ subject: e.target.value })}
          options={[{ value: "client", label: "A client" }, { value: "employee", label: "An employee" }]} />

        <div>
          <MonoLabel rule style={{ marginBottom: 10 }}>Who fills it in</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ROLES.map((r) => (
              <Checkbox key={r.value} label={r.label} checked={roles.includes(r.value)}
                onChange={() => toggleRole(r.value)} />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** What the form will look like to the person filling it in. */
function Preview({ template }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      {(template.sections || []).map((section) => (
        <section key={section.id}>
          <MonoLabel rule count={(section.fields || []).length} style={{ marginBottom: 16 }}>
            {section.title}
          </MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {(section.fields || []).map((f) => {
              const common = { label: f.label || "Untitled field", key: f.id };
              if (f.type === "policyText") {
                return (
                  <Panel key={f.id} tone="sunken">
                    <Text role="body" color="secondary">{f.body || "No wording yet."}</Text>
                  </Panel>
                );
              }
              if (f.type === "textarea") return <Textarea {...common} rows={4} placeholder={f.placeholder} readOnly />;
              if (f.type === "signature") return <SignaturePad {...common} />;
              if (f.type === "select") {
                return <Select {...common} options={(f.options || []).map((o) => ({ value: o.label, label: o.label }))} />;
              }
              if (f.type === "radio" || f.type === "checkbox") {
                return (
                  <div key={f.id}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8, color: "var(--text-body)" }}>
                      {f.label || "Untitled field"}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {(f.options || []).map((o, i) => (
                        <Checkbox key={i} label={o.label} checked={false} onChange={() => {}} />
                      ))}
                    </div>
                  </div>
                );
              }
              const inputType = { date: "date", time: "time", number: "number", tel: "tel", email: "email" }[f.type];
              return <Input {...common} type={inputType} placeholder={f.placeholder} readOnly />;
            })}
            {(section.fields || []).length === 0 && (
              <Text role="body" color="quiet">Nothing in this section yet.</Text>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export function FormBuilder({ templateKey, initial, onClose, onToast }) {
  const Store = useStore();
  const area = useAreaLabel();

  // Held locally and saved explicitly. Editing a published form through the
  // live store would change what people are filling in while they fill it.
  const [template, setTemplate] = React.useState(() => {
    const source = initial || Store.getTemplate(templateKey);
    const copy = source ? JSON.parse(JSON.stringify(source)) : { key: templateKey, name: "Untitled form", sections: [] };
    if (!Array.isArray(copy.sections) || copy.sections.length === 0) {
      copy.sections = [{ id: newId("s"), title: "Details", fields: [] }];
    }
    return copy;
  });
  const [selected, setSelected] = React.useState(null); // { si, fi }
  const [adding, setAdding] = React.useState(null);     // section index awaiting a type
  const [showChecklist, setShowChecklist] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [dirty, setDirty] = React.useState(!!initial);

  const selectedField = selected ? template.sections[selected.si]?.fields?.[selected.fi] : null;

  // Every mutation goes through here so nothing can forget to mark the draft
  // dirty — an unsaved change that looks saved is the worst outcome.
  const edit = (fn) => {
    setTemplate((t) => {
      const next = JSON.parse(JSON.stringify(t));
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const patchTemplate = (patch) => edit((t) => Object.assign(t, patch));
  const patchField = (patch) => edit((t) => Object.assign(t.sections[selected.si].fields[selected.fi], patch));

  const addField = (si, type) => {
    const meta = TYPE_META[type];
    const field = {
      id: newId("f"),
      label: meta.label === "Text to read" ? "" : "",
      type,
      required: false,
      ...(NEEDS_OPTIONS.has(type) ? { options: [{ label: "Yes" }, { label: "No" }] } : {}),
      ...(type === "policyText" ? { body: "" } : {}),
    };
    let fi = 0;
    edit((t) => { fi = t.sections[si].fields.push(field) - 1; });
    setAdding(null);
    setSelected({ si, fi });
  };

  const moveField = (si, fi, dir) => {
    const to = fi + dir;
    const fields = template.sections[si].fields;
    if (to < 0 || to >= fields.length) return;
    edit((t) => {
      const f = t.sections[si].fields;
      [f[fi], f[to]] = [f[to], f[fi]];
    });
    setSelected({ si, fi: to });
  };

  const removeField = (si, fi) => {
    edit((t) => t.sections[si].fields.splice(fi, 1));
    setSelected(null);
  };

  const addSection = () => edit((t) => t.sections.push({ id: newId("s"), title: "New section", fields: [] }));

  const removeSection = (si) => {
    edit((t) => t.sections.splice(si, 1));
    setSelected(null);
  };

  const save = async () => {
    setBusy(true);
    try {
      await Store.saveTemplate(template);
      setDirty(false);
      onToast && onToast("Draft saved");
    } catch (err) {
      onToast && onToast(err.message || "Couldn't save that");
    } finally { setBusy(false); }
  };

  const checklist = publishChecklist(template);
  const blockers = checklist.filter((c) => c.blocking && !c.ok);
  const canPublish = blockers.length === 0;

  const publish = async () => {
    setBusy(true);
    try {
      await Store.saveTemplate(template);
      await Store.publishTemplate(template.key);
      setDirty(false);
      setShowChecklist(false);
      onToast && onToast(`${template.name} is live`);
      onClose();
    } catch (err) {
      onToast && onToast(err.message || "Couldn't publish that");
    } finally { setBusy(false); }
  };

  const fieldTotal = (template.sections || []).reduce((n, s) => n + (s.fields || []).length, 0);

  return (
    <>
      <SheetHeader
        eyebrow={`${area} / Templates / ${template.name || "Untitled form"}`}
        title={template.name || "Untitled form"}
        lead={
          template.sourceFile
            ? `Read from ${template.sourceFile}. Edit anything the importer got wrong.`
            : "Build the form by adding questions. Nothing is live until you publish it."
        }
        actions={
          <>
            <Button variant="outline" iconLeft={<Icon name="arrowLeft" size={16} />} onClick={onClose}>
              {dirty ? "Discard & close" : "Close"}
            </Button>
            <Button variant="outline" iconLeft={<Icon name="eye" size={16} />} onClick={() => setPreviewing((v) => !v)}>
              {previewing ? "Back to editing" : "Preview"}
            </Button>
            <Button variant="secondary" disabled={busy || !dirty} onClick={save}>
              {busy ? "Working…" : dirty ? "Save draft" : "Saved"}
            </Button>
            <Button disabled={busy} onClick={() => setShowChecklist(true)}>Publish</Button>
          </>
        }
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 26, flexWrap: "wrap", alignItems: "center" }}>
        <Stamp tone={template.status === "published" ? "success" : "neutral"}>
          {template.status === "published" ? "Published" : "Draft"}
        </Stamp>
        <Chip icon={<Icon name="list" size={14} />}>{fieldTotal} {fieldTotal === 1 ? "field" : "fields"}</Chip>
        <Chip icon={<Icon name="layers" size={14} />}>{template.sections.length} {template.sections.length === 1 ? "section" : "sections"}</Chip>
        {dirty && <span style={{ fontSize: 12.5, color: "var(--text-quiet)" }}>Unsaved changes</span>}
      </div>

      {previewing ? (
        <Panel padding={32} style={{ maxWidth: 720 }}>
          <Preview template={template} />
        </Panel>
      ) : (
        <div className="split" style={{ alignItems: "start" }}>
          <section style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {template.sections.map((section, si) => (
              <div key={section.id}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <Input
                    value={section.title}
                    onChange={(e) => edit((t) => { t.sections[si].title = e.target.value; })}
                    style={{ flex: 1, maxWidth: 340 }}
                  />
                  <MonoLabel count={(section.fields || []).length}>Fields</MonoLabel>
                  <span style={{ flex: 1 }} />
                  {template.sections.length > 1 && (
                    <IconButton icon={<Icon name="trash" size={15} />} label="Remove section"
                      size="sm" onClick={() => removeSection(si)} />
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {(section.fields || []).map((f, fi) => (
                    <FieldRow
                      key={f.id}
                      field={f}
                      selected={selected?.si === si && selected?.fi === fi}
                      onSelect={() => setSelected({ si, fi })}
                      onMove={(d) => moveField(si, fi, d)}
                      onRemove={() => removeField(si, fi)}
                      first={fi === 0}
                      last={fi === section.fields.length - 1}
                    />
                  ))}

                  {(section.fields || []).length === 0 && (
                    <div style={{
                      padding: "18px 16px", borderRadius: "var(--radius-md)",
                      border: "1px dashed var(--border-default)", color: "var(--text-quiet)", fontSize: 13,
                    }}>
                      No questions in this section yet.
                    </div>
                  )}

                  {adding === si ? (
                    <Panel padding={14} tone="sunken">
                      <MonoLabel rule style={{ marginBottom: 12 }}>Pick an answer type</MonoLabel>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 7 }}>
                        {FIELD_TYPES.map((t) => (
                          <button
                            key={t.type}
                            type="button"
                            onClick={() => addField(si, t.type)}
                            title={t.hint}
                            style={{
                              display: "flex", alignItems: "center", gap: 9, textAlign: "left",
                              padding: "10px 12px", borderRadius: "var(--radius-sm)",
                              background: "var(--surface-card)", border: "1px solid var(--border-hair)",
                              cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--text-body)",
                            }}
                          >
                            <Icon name={t.icon} size={15} />
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <Button size="sm" variant="ghost" style={{ marginTop: 12 }} onClick={() => setAdding(null)}>
                        Cancel
                      </Button>
                    </Panel>
                  ) : (
                    <Button size="sm" variant="outline" iconLeft={<Icon name="plus" size={15} />}
                      style={{ alignSelf: "flex-start", marginTop: 4 }}
                      onClick={() => setAdding(si)}>
                      Add a question
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <Button variant="ghost" iconLeft={<Icon name="layers" size={16} />}
              style={{ alignSelf: "flex-start" }} onClick={addSection}>
              Add a section
            </Button>
          </section>

          <aside>
            {selectedField ? (
              <FieldInspector field={selectedField} onPatch={patchField} onClose={() => setSelected(null)} />
            ) : (
              <FormInspector template={template} onPatch={patchTemplate} />
            )}
          </aside>
        </div>
      )}

      <Dialog
        open={showChecklist}
        title={`Publish ${template.name}?`}
        description="Publishing makes this form available to everyone assigned to complete it."
        onClose={() => setShowChecklist(false)}
        width={520}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowChecklist(false)}>Cancel</Button>
            <Button disabled={!canPublish || busy} onClick={publish}>
              {busy ? "Publishing…" : canPublish ? "Publish now" : "Fix the blockers first"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {checklist.map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5 }}>
              <span style={{
                flex: "0 0 auto", marginTop: 1,
                color: item.ok ? "var(--status-success)" : item.blocking ? "var(--status-danger)" : "var(--status-warning)",
              }}>
                <Icon name={item.ok ? "checkCircle" : "alert"} size={16} />
              </span>
              <span style={{ color: item.ok ? "var(--text-body)" : "var(--text-secondary)" }}>
                {item.label}
                {!item.ok && !item.blocking && (
                  <span style={{ color: "var(--text-quiet)" }}> — you can publish anyway</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </Dialog>

      <HelpBot {...HELP.builder} storageKey="builder" />
    </>
  );
}

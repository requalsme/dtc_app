// Where a new form comes from.
//
// WHY THIS EXISTS
// "Import PDF" used to be the only way to create a template, which quietly
// decided that every form the agency would ever use must already exist on
// paper. That is not true — a supply request or an incident report has no
// paper original and never needed one.
//
// But "start from blank" on its own is not much better. Most of what an agency
// needs is close to something it already has, and the fastest honest answer to
// "make me a visit note" is usually a form that is already 80% right. So this
// screen offers the four real starting points and is explicit about what each
// one costs, instead of hiding three of them behind the fourth.

import React from "react";
import { Icon, Button, Panel, MonoLabel, Input, Select, EmptyState, Stamp, Text, RecordRow } from "../design/index.js";
import { SheetHeader, useAreaLabel } from "./Chrome.jsx";
import { useStore } from "./useStore.js";

const f = (label, type, extra = {}) => ({
  id: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40),
  label, type, required: false, ...extra,
});

/**
 * Starting shapes for the forms a home care agency actually keeps.
 *
 * Deliberately short. A starter that guesses at twenty fields is worse than
 * one that gives eight right ones, because deleting someone else's wrong
 * questions is slower than adding your own.
 */
const PATTERNS = [
  {
    key: "visit_note",
    name: "Visit note",
    icon: "clients",
    description: "What happened on a single visit — the everyday record.",
    subject: "client",
    category: "Client care",
    completedBy: ["caregiver", "officeManager", "admin"],
    sections: [
      { id: "s_visit", title: "The visit", fields: [
        f("Client", "text", { required: true }),
        f("Caregiver", "text", { required: true }),
        f("Date", "date", { required: true }),
        f("Time in", "time"),
        f("Time out", "time"),
      ] },
      { id: "s_care", title: "Care given", fields: [
        f("Tasks completed", "checkbox", { options: [
          { label: "Personal care" }, { label: "Meal preparation" }, { label: "Light housekeeping" },
          { label: "Medication reminder" }, { label: "Mobility assistance" }, { label: "Companionship" },
        ] }),
        f("Notes", "textarea"),
        f("Anything to report to the office", "radio", { options: [{ label: "No" }, { label: "Yes" }] }),
      ] },
      { id: "s_sign", title: "Signatures", fields: [
        f("Caregiver signature", "signature", { required: true }),
      ] },
    ],
  },
  {
    key: "incident",
    name: "Incident report",
    icon: "alert",
    description: "A fall, an injury, a near miss — anything that has to be written down the same day.",
    subject: "client",
    category: "Incident",
    completedBy: ["caregiver", "officeManager", "admin"],
    sections: [
      { id: "s_who", title: "Who and when", fields: [
        f("Client", "text", { required: true }),
        f("Reported by", "text", { required: true }),
        f("Date of incident", "date", { required: true }),
        f("Time of incident", "time"),
        f("Where it happened", "text"),
      ] },
      { id: "s_what", title: "What happened", fields: [
        f("Type of incident", "radio", { required: true, options: [
          { label: "Fall" }, { label: "Injury" }, { label: "Near miss" },
          { label: "Medication issue" }, { label: "Property damage" }, { label: "Other" },
        ] }),
        f("Describe what happened", "textarea", { required: true }),
        f("Was anyone injured", "radio", { options: [{ label: "No" }, { label: "Yes" }] }),
        f("Action taken", "textarea"),
        f("Were emergency services called", "radio", { options: [{ label: "No" }, { label: "Yes" }] }),
      ] },
      { id: "s_sign", title: "Signatures", fields: [
        f("Reporter signature", "signature", { required: true }),
        f("Supervisor signature", "signature"),
        f("Date reviewed", "date"),
      ] },
    ],
  },
  {
    key: "acknowledgement",
    name: "Policy acknowledgement",
    icon: "shield",
    description: "Wording to read and a signature to confirm it. The shape most compliance forms take.",
    subject: "employee",
    category: "Compliance",
    completedBy: ["caregiver", "officeManager", "admin"],
    sections: [
      { id: "s_policy", title: "The policy", fields: [
        { id: "policy_body", type: "policyText", label: "Policy wording",
          body: "Replace this with the policy the employee is agreeing to." },
      ] },
      { id: "s_ack", title: "Acknowledgement", fields: [
        f("Employee name", "text", { required: true }),
        f("Date", "date", { required: true }),
        f("Employee signature", "signature", { required: true }),
      ] },
    ],
  },
  {
    key: "request",
    name: "Request form",
    icon: "inbox",
    description: "Someone asks for something and someone else approves it — time off, supplies, mileage.",
    subject: "employee",
    category: "Employee",
    completedBy: ["caregiver", "officeManager", "admin"],
    sections: [
      { id: "s_req", title: "The request", fields: [
        f("Employee name", "text", { required: true }),
        f("Date submitted", "date", { required: true }),
        f("What is being requested", "textarea", { required: true }),
        f("Needed by", "date"),
      ] },
      { id: "s_appr", title: "Agency use only", fields: [
        f("Decision", "radio", { options: [{ label: "Approved" }, { label: "Denied" }] }),
        f("Notes", "textarea"),
        f("Supervisor signature", "signature"),
        f("Date", "date"),
      ] },
    ],
  },
];

function Route({ icon, title, description, meta, onClick, tone }) {
  return (
    <Panel interactive accentEdge={tone === "primary"} onClick={onClick} padding={22}
      style={{ cursor: "pointer", height: "100%" }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span style={{
          display: "grid", placeItems: "center", width: 40, height: 40, flex: "0 0 auto",
          borderRadius: "var(--radius-sm)",
          background: tone === "primary" ? "var(--surface-accent)" : "var(--surface-sunken)",
          color: tone === "primary" ? "var(--brand-accent)" : "var(--text-secondary)",
        }}>
          <Icon name={icon} size={19} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--text-body)", marginBottom: 5 }}>{title}</div>
          <Text role="body" color="secondary" style={{ fontSize: 13.5, lineHeight: 1.55 }}>{description}</Text>
          {meta && <div style={{ marginTop: 9, fontSize: 12.5, color: "var(--text-quiet)" }}>{meta}</div>}
        </div>
      </div>
    </Panel>
  );
}

/**
 * @param {(template:object)=>void} onEdit  open the builder on this template
 * @param {()=>void}                onImport  hand off to the PDF import flow
 */
export function NewFormScreen({ onEdit, onImport, onBack, onToast }) {
  const Store = useStore();
  const area = useAreaLabel();

  const [mode, setMode] = React.useState(null); // "blank" | "pattern" | "copy"
  const [name, setName] = React.useState("");
  const [pattern, setPattern] = React.useState(PATTERNS[0].key);
  const [copyKey, setCopyKey] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const templates = Store.getTemplates();

  const create = async () => {
    setBusy(true);
    try {
      let template;
      if (mode === "copy") {
        template = await Store.duplicateTemplate(copyKey, name.trim() || undefined);
      } else if (mode === "pattern") {
        const p = PATTERNS.find((x) => x.key === pattern);
        template = await Store.createTemplate({
          name: name.trim() || p.name,
          category: p.category,
          subject: p.subject,
          completedBy: p.completedBy,
          description: p.description,
          // Deep-copied so editing one form built from a pattern cannot reach
          // back and change the pattern for every form made after it.
          sections: JSON.parse(JSON.stringify(p.sections)),
        });
      } else {
        template = await Store.createTemplate({ name: name.trim() || "Untitled form" });
      }
      onToast && onToast(`${template.name} created`);
      onEdit(template);
    } catch (err) {
      onToast && onToast(err.message || "Couldn't create that form");
    } finally { setBusy(false); }
  };

  const chosen = PATTERNS.find((p) => p.key === pattern);
  const patternFieldCount = chosen ? chosen.sections.reduce((n, s) => n + s.fields.length, 0) : 0;

  return (
    <>
      <SheetHeader
        eyebrow={`${area} / Templates / New`}
        title="Start a new form"
        lead="Build one from scratch, begin from a shape the agency already uses, copy a form that works, or read one in from a PDF."
        actions={
          <Button variant="outline" iconLeft={<Icon name="arrowLeft" size={16} />} onClick={onBack}>
            All templates
          </Button>
        }
      />

      {!mode ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, maxWidth: 900 }}>
          <Route
            icon="upload" tone="primary" title="Read it in from a PDF"
            description="Upload a form the agency already prints. The questions on the page are turned into fields, and the original is kept so answers can be printed back onto it."
            meta="Best for anything official or already in use"
            onClick={onImport}
          />
          <Route
            icon="sparkle" title="Start from a familiar shape"
            description="A visit note, an incident report, a policy acknowledgement, or a request form — already laid out, ready to adjust."
            meta={`${PATTERNS.length} starting points`}
            onClick={() => setMode("pattern")}
          />
          <Route
            icon="layers" title="Copy a form that works"
            description="Duplicate one of your existing forms and change what needs changing. The copy starts as a draft."
            meta={`${templates.length} to copy from`}
            onClick={() => setMode("copy")}
          />
          <Route
            icon="plus" title="Start blank"
            description="An empty form with one section. Every question added by hand."
            meta="Most control, most work"
            onClick={() => setMode("blank")}
          />
        </div>
      ) : (
        <div style={{ maxWidth: 620, display: "flex", flexDirection: "column", gap: 22 }}>
          <Panel>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Input
                label="What is this form called?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === "pattern" ? chosen?.name : "Untitled form"}
                hint="You can change this later."
              />

              {mode === "pattern" && (
                <>
                  <Select
                    label="Starting shape"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    options={PATTERNS.map((p) => ({ value: p.key, label: p.name }))}
                  />
                  {chosen && (
                    <Panel tone="sunken" padding={16}>
                      <Text role="body" color="secondary" style={{ fontSize: 13.5 }}>{chosen.description}</Text>
                      <div style={{ marginTop: 12 }}>
                        <MonoLabel count={patternFieldCount} style={{ marginBottom: 8 }}>Comes with</MonoLabel>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                          {chosen.sections.map((s) => (
                            <div key={s.id}>{s.title} — {s.fields.length} {s.fields.length === 1 ? "field" : "fields"}</div>
                          ))}
                        </div>
                      </div>
                    </Panel>
                  )}
                </>
              )}

              {mode === "copy" && (
                templates.length === 0 ? (
                  <EmptyState title="Nothing to copy yet" description="There are no forms in the library to duplicate." />
                ) : (
                  <Select
                    label="Form to copy"
                    value={copyKey}
                    onChange={(e) => setCopyKey(e.target.value)}
                    options={[
                      { value: "", label: "Choose a form…" },
                      ...templates.map((t) => ({ value: t.key, label: t.name })),
                    ]}
                  />
                )
              )}
            </div>
          </Panel>

          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
            <span style={{ flex: 1 }} />
            <Button disabled={busy || (mode === "copy" && !copyKey)} onClick={create}>
              {busy ? "Creating…" : "Create and open"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

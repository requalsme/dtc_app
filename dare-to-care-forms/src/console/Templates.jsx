// Templates — the forms this agency uses, and what each one actually contains.
//
// The screen this replaces listed forms by name and status, which told you a
// template existed but nothing about what it asks. Opening one now shows the
// document: the scanned page it came from with the captured fields drawn over
// it, or, for a form built in the app, a plain reading view of its fields.
//
// That matters beyond convenience. A template defines what every future
// submission means, so publishing one without being able to read it is a
// decision made blind — and for anything imported from paper, the original
// page is the thing a surveyor will ask to see.

import React from "react";
import { Icon, Button, Stamp, MonoLabel, Input, Select, Panel, RecordRow, EmptyState, Chip, HelpBot } from "../design/index.js";
import { SheetHeader, useAreaLabel } from "./Chrome.jsx";
import { useStore } from "./useStore.js";
import { DocumentView } from "./DocumentView.jsx";
import { HELP } from "./helpTips.js";

const STATUS_STAMP = {
  published: ["success", "Published"],
  draft: ["neutral", "Draft"],
};

const fieldCount = (t) => (t.sections || []).reduce((n, s) => n + (s.fields || []).length, 0);

const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

function TemplateDetail({ template, onBack, onPublish, onUnpublish, onEdit, busy }) {
  const area = useAreaLabel();
  const stamp = STATUS_STAMP[template.status] || ["neutral", template.status || "Draft"];
  const count = fieldCount(template);
  const published = template.status === "published";

  const facts = [
    template.category && { icon: "layers", text: template.category },
    template.subject && { icon: "clients", text: "About a " + template.subject },
    template.sourcePages && { icon: "file", text: template.sourcePages + (template.sourcePages === 1 ? " page" : " pages") },
    template.estMin && { icon: "clock", text: "~" + template.estMin + " min" },
  ].filter(Boolean);

  return (
    <>
      <SheetHeader
        eyebrow={area + " / Templates / " + template.name}
        title={template.name}
        lead={
          template.description ||
          (template.sourceFile ? "Imported from " + template.sourceFile + "." : "Built in the app.")
        }
        actions={
          <>
            <Button variant="outline" iconLeft={<Icon name="arrowLeft" size={16} />} onClick={onBack}>
              All templates
            </Button>
            {onEdit && (
              <Button variant="outline" iconLeft={<Icon name="edit" size={16} />} onClick={() => onEdit(template.key)}>
                Edit form
              </Button>
            )}
            {published ? (
              <Button variant="outline" disabled={busy} onClick={() => onUnpublish(template)}>
                {busy ? "Working…" : "Unpublish"}
              </Button>
            ) : (
              <Button disabled={busy || count === 0} onClick={() => onPublish(template)}>
                {busy ? "Working…" : "Publish"}
              </Button>
            )}
          </>
        }
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
        <Stamp tone={stamp[0]}>{stamp[1]}</Stamp>
        <Chip icon={<Icon name="list" size={14} />}>{count} {count === 1 ? "field" : "fields"}</Chip>
        {facts.map((f) => <Chip key={f.text} icon={<Icon name={f.icon} size={14} />}>{f.text}</Chip>)}
        {template.updatedAt && (
          <span style={{ fontSize: 12.5, color: "var(--text-quiet)" }}>Updated {fmtDate(template.updatedAt)}</span>
        )}
      </div>

      {count === 0 && !template.sourcePath ? (
        <EmptyState
          title="Nothing to show yet"
          description="This template has no fields and no source document. Import a PDF or add fields in the builder."
        />
      ) : (
        // values is empty here on purpose: a template is the blank form, so the
        // overlay shows where each field sits and what it is called, not data.
        // The same view renders a filled submission by passing its answers in.
        <DocumentView template={template} values={{}} sourcePath={template.sourcePath} />
      )}
    </>
  );
}

export function TemplatesScreen({ onToast, onNew, onEdit }) {
  const Store = useStore();
  const area = useAreaLabel();

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [openKey, setOpenKey] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const all = Store.getTemplates();

  // Re-read from the store rather than holding the clicked object, so a publish
  // is reflected without closing and reopening.
  const open = openKey ? all.find((t) => t.key === openKey) : null;

  const doPublish = async (t) => {
    setBusy(true);
    try { await Store.publishTemplate(t.key); onToast && onToast(t.name + " published"); }
    catch (err) { onToast && onToast(err.message || "Couldn't publish that"); }
    finally { setBusy(false); }
  };

  const doUnpublish = async (t) => {
    setBusy(true);
    try { await Store.unpublishTemplate(t.key); onToast && onToast(t.name + " unpublished"); }
    catch (err) { onToast && onToast(err.message || "Couldn't unpublish that"); }
    finally { setBusy(false); }
  };

  if (open) {
    return (
      <>
        <TemplateDetail
          template={open}
          onBack={() => setOpenKey(null)}
          onPublish={doPublish}
          onUnpublish={doUnpublish}
          onEdit={onEdit}
          busy={busy}
        />
        <HelpBot {...HELP.templates} storageKey="templates" />
      </>
    );
  }

  const filtered = all
    .filter((t) => status === "all" || (status === "published" ? t.status === "published" : t.status !== "published"))
    .filter((t) => {
      if (!search.trim()) return true;
      return [t.name, t.category, t.sourceFile].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase());
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  const published = all.filter((t) => t.status === "published").length;

  return (
    <>
      <SheetHeader
        eyebrow={area + " / Templates"}
        title="Templates"
        lead="Every form the agency can send out. Open one to read what it asks and, where it came from paper, to see the original page."
        actions={
          onNew && (
            <Button iconLeft={<Icon name="plus" size={16} />} onClick={onNew}>
              Start a new form
            </Button>
          )
        }
      />

      <div style={{ display: "flex", gap: 12, margin: "0 0 26px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 300 }}>
          <Input
            placeholder="Search forms"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            iconLeft={<Icon name="search" size={17} />}
          />
        </div>
        <div style={{ width: 190 }}>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "all", label: "All templates" },
              { value: "published", label: "Published" },
              { value: "draft", label: "Drafts" },
            ]}
          />
        </div>
        <span style={{ flex: 1 }} />
        <MonoLabel count={published}>Published</MonoLabel>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? "No templates yet" : "Nothing matches that"}
          description={all.length === 0
            ? "Build one from scratch, start from a familiar shape, or read one in from a PDF."
            : "Try a different search, or clear the status filter."}
          action={all.length === 0 && onNew
            ? <Button iconLeft={<Icon name="plus" size={16} />} onClick={onNew}>Start a new form</Button>
            : undefined}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 820 }}>
          {filtered.map((t) => {
            const stamp = STATUS_STAMP[t.status] || ["neutral", t.status || "Draft"];
            const n = fieldCount(t);
            return (
              <RecordRow
                key={t.key}
                icon={<Icon name={t.sourcePath ? "file" : "fileText"} size={17} />}
                title={t.name}
                subtitle={
                  [n + (n === 1 ? " field" : " fields"), t.category, t.sourceFile]
                    .filter(Boolean).join(" · ")
                }
                meta={fmtDate(t.updatedAt) || ""}
                stamp={<Stamp tone={stamp[0]}>{stamp[1]}</Stamp>}
                accentEdge={t.status === "published"}
                onClick={() => setOpenKey(t.key)}
              />
            );
          })}
        </div>
      )}

      <HelpBot {...HELP.templates} storageKey="templates" />
    </>
  );
}

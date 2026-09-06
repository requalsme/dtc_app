// The audit log, rebuilt from the design kit's AuditLog.
//
// The entries are append-only in Postgres — the `audit` table has no update
// policy and no delete policy, for anyone, which is the whole point of a log.
// The lead copy says so plainly, because a reviewer needs to know the trail
// they are reading cannot have been tidied up.
//
// The kit numbered its rows 1..n from a fixed array. Real entries arrive
// newest-first and the list is filterable, so a positional number would change
// as soon as anyone typed in the search box — a "No. 14" that means something
// different per filter is worse than no number. Numbering is therefore against
// the full ordered log, and stays put as filters narrow it.

import React from "react";
import { Icon, Button, MonoLabel, Avatar, Input, Select, Chip } from "../design/index.js";
import { SheetHeader, useAreaLabel } from "./Chrome.jsx";
import { useStore } from "./useStore.js";

const AUDIT_COLS = "44px max-content minmax(120px,1fr) minmax(150px,1.3fr) minmax(180px,2fr)";

// Action keys as written by store.js, turned into the plain language the brand
// asks for: "form_submitted" is not something anyone says out loud.
const ACTION_LABEL = {
  form_submitted: "Filed a form",
  form_reviewed: "Marked reviewed",
  form_filed: "Filed a PDF",
  form_resubmitted: "Resubmitted",
  correction_requested: "Asked for a correction",
  submission_updated: "Updated a submission",
  submission_deleted: "Removed from view",
  submission_restored: "Restored",
  submission_hard_deleted: "Deleted permanently",
  template_imported: "Imported a template",
  template_saved: "Saved a template",
  template_published: "Published a template",
  template_unpublished: "Unpublished a template",
  user_created: "Created an account",
  user_updated: "Updated an account",
  client_created: "Added a client",
  client_updated: "Updated a client",
  document_uploaded: "Uploaded a document",
  certificate_linked: "Linked a certificate",
  inbound_filed: "Filed an inbound document",
  inbound_dismissed: "Dismissed an inbound document",
  application_reviewed: "Reviewed an application",
  recurring_task_scheduled: "Scheduled the next visit",
};

const prettyAction = (a) =>
  ACTION_LABEL[a] || String(a || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const STAFF_ROLES = ["admin", "officeManager"];

const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase()
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const WINDOWS = { "Any time": Infinity, "Today": 1, "Last 7 days": 7, "Last 30 days": 30 };

export function AuditLog() {
  const Store = useStore();
  const area = useAreaLabel();
  const [q, setQ] = React.useState("");
  const [group, setGroup] = React.useState("All activity");
  const [window_, setWindow] = React.useState("Any time");

  // Newest first, and numbered against this full ordering so a row keeps its
  // number no matter how the list is later filtered.
  const ordered = React.useMemo(() => {
    const rows = Store.getAudit()
      .slice()
      .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
    const total = rows.length;
    return rows.map((r, i) => ({ ...r, n: total - i }));
  }, [Store.getAudit().length]);

  const days = WINDOWS[window_] ?? Infinity;
  const cutoff = days === Infinity ? 0 : Date.now() - days * 86400000;

  const rows = ordered
    .filter((r) => {
      if (group === "All activity") return true;
      if (group === "Office staff") return STAFF_ROLES.includes(r.role);
      if (group === "Caregivers") return r.role === "caregiver";
      return !r.role || r.role === "system" || r.role === "unknown";
    })
    .filter((r) => !r.timestamp || new Date(r.timestamp).getTime() >= cutoff)
    .filter((r) => {
      if (!q.trim()) return true;
      const hay = [r.actor, prettyAction(r.action), r.target, r.detail].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });

  return (
    <div data-density="dense">
      <SheetHeader
        eyebrow={area + " / Audit log"}
        title="Audit log"
        lead="Every action taken in the application, newest first. Entries are numbered, and the database allows no one to edit or delete them."
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ width: 300 }}>
          <Input
            placeholder="Search people, actions or records"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            iconLeft={<Icon name="search" size={17} />}
          />
        </div>
        <div style={{ width: 190 }}>
          <Select value={group} onChange={(e) => setGroup(e.target.value)}
            options={["All activity", "Office staff", "Caregivers", "System"]} />
        </div>
        <div style={{ width: 170 }}>
          <Select value={window_} onChange={(e) => setWindow(e.target.value)} options={Object.keys(WINDOWS)} />
        </div>
        <span style={{ flex: 1 }} />
        <Chip icon={<Icon name="clock" size={13} />}>Append-only</Chip>
      </div>

      <MonoLabel rule count={rows.length} style={{ marginBottom: 4 }}>Entries</MonoLabel>

      <div className="ledger-head" style={{ gridTemplateColumns: AUDIT_COLS, gap: 16 }}>
        {["No.", "Time", "Who", "Action", "Record"].map((h, i) => (
          <span key={i} style={{
            fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: 11,
            fontWeight: 600, letterSpacing: "0.1em", color: "var(--text-quiet)",
          }}>{h}</span>
        ))}
      </div>

      {rows.map((r) => {
        const isSystem = !r.role || r.role === "system" || r.role === "unknown";
        return (
          <div key={r.id || r.n} className="ledger-row audit-row" style={{ gridTemplateColumns: AUDIT_COLS, gap: 16 }}>
            <span style={{
              fontFamily: "var(--font-figure)", fontSize: 13.5, fontWeight: 500,
              fontVariantNumeric: "tabular-nums", color: "var(--text-quiet)",
            }}>{r.n}</span>
            <span style={{
              fontFamily: "var(--font-figure)", fontSize: 13.5,
              fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)", whiteSpace: "nowrap",
            }}>{fmtTime(r.timestamp)}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, minWidth: 0 }}>
              {isSystem
                ? <span style={{ display: "flex", color: "var(--text-quiet)" }}><Icon name="refresh" size={15} /></span>
                : <Avatar name={r.actor || "?"} size={22} role={r.role === "caregiver" ? "caregiver" : "office"} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.actor || "System"}</span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.005em" }}>{prettyAction(r.action)}</span>
            <span style={{
              fontSize: 14, color: "var(--text-secondary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }} title={[r.target, r.detail].filter(Boolean).join(" — ")}>
              {[r.target, r.detail].filter(Boolean).join(" — ") || "—"}
            </span>
          </div>
        );
      })}

      {rows.length === 0 && (
        <div style={{ borderTop: "1px solid var(--border-hair)", padding: "36px 4px", color: "var(--text-secondary)", fontSize: 15 }}>
          {ordered.length === 0 ? "Nothing has been recorded yet." : "No entries match that filter."}
        </div>
      )}
    </div>
  );
}

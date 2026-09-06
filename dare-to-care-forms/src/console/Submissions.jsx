// The submissions ledger, rebuilt from the design kit's SubmissionsLedger.
//
// A drop-in replacement for SubmissionsList in OfficeManagerApp: it takes the
// same `onView` callback, so opening a record still goes through the existing
// SubmissionDetail with its review and request-correction actions. Only the
// list itself changed.
//
// The kit's version had three filter dropdowns, two of which ("Last 7 days",
// "All caregivers") were decorative — they were rendered but wired to nothing.
// Here the caregiver filter is built from the caregivers who have actually
// filed something, and the date filter is real. A control that does not do
// what it says is worse than an absent one, because a reviewer will trust it.

import React from "react";
import { Icon, Button, Stamp, MonoLabel, Avatar, Tabs, Input, Select, Panel } from "../design/index.js";
import { SheetHeader, useAreaLabel } from "./Chrome.jsx";
import { useStore } from "./useStore.js";

const SUB_COLS = "minmax(140px,1.7fr) minmax(90px,1.1fr) minmax(90px,1fr) max-content 156px";

const STATUS_STAMP = {
  submitted: ["info", "Submitted"],
  reviewed: ["success", "Reviewed"],
  needsCorrection: ["warning", "Needs correction"],
};

const relTime = (iso) => {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const WINDOWS = {
  "Any time": Infinity,
  "Today": 1,
  "Last 7 days": 7,
  "Last 30 days": 30,
};

export function SubmissionsLedger({ onView }) {
  const Store = useStore();
  const area = useAreaLabel();
  const [tab, setTab] = React.useState("open");
  const [q, setQ] = React.useState("");
  const [who, setWho] = React.useState("All caregivers");
  const [window_, setWindow] = React.useState("Any time");

  const all = Store.getSubmissions().filter((s) => !s.deletedAt);

  // Only offer caregivers who actually appear in the ledger — a filter listing
  // people with nothing to find is a dead end dressed up as a choice.
  const caregivers = React.useMemo(
    () => ["All caregivers", ...Array.from(new Set(all.map((s) => s.caregiverName).filter(Boolean))).sort()],
    [all],
  );

  const open = all.filter((s) => s.status !== "reviewed");
  const reviewed = all.filter((s) => s.status === "reviewed");

  const days = WINDOWS[window_] ?? Infinity;
  const cutoff = days === Infinity ? 0 : Date.now() - days * 86400000;

  const filtered = (tab === "open" ? open : tab === "reviewed" ? reviewed : all)
    .filter((s) => who === "All caregivers" || s.caregiverName === who)
    .filter((s) => !s.submittedAt || new Date(s.submittedAt).getTime() >= cutoff)
    .filter((s) => {
      if (!q.trim()) return true;
      const hay = [s.templateName, s.schemaKey, s.clientName, s.caregiverName].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    })
    .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));

  // The record that has been waiting longest without being reviewed. This is
  // the one question a reviewer actually asks of a queue.
  const oldestOpen = open
    .slice()
    .sort((a, b) => String(a.submittedAt || "").localeCompare(String(b.submittedAt || "")))[0];

  const needsCorrection = all.filter((s) => s.status === "needsCorrection");

  return (
    <>
      <SheetHeader
        eyebrow={area + " / Submissions"}
        title="Submissions"
        lead="Every form a caregiver has sent in, newest first. Open one to read it, mark it reviewed, or send it back for a correction."
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "open", label: "Needs review", count: open.length },
          { value: "reviewed", label: "Reviewed", count: reviewed.length },
          { value: "all", label: "All", count: all.length },
        ]}
      />

      <div style={{ display: "flex", gap: 12, margin: "22px 0 26px", flexWrap: "wrap" }}>
        <div style={{ width: 300 }}>
          <Input
            placeholder="Search forms, clients or caregivers"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            iconLeft={<Icon name="search" size={17} />}
          />
        </div>
        <div style={{ width: 200 }}>
          <Select value={who} onChange={(e) => setWho(e.target.value)} options={caregivers} />
        </div>
        <div style={{ width: 170 }}>
          <Select value={window_} onChange={(e) => setWindow(e.target.value)} options={Object.keys(WINDOWS)} />
        </div>
      </div>

      <div className="split" style={{ alignItems: "start" }}>
        <section>
          <MonoLabel rule count={filtered.length} style={{ marginBottom: 4 }}>Ledger</MonoLabel>

          <div className="ledger-head" style={{ gridTemplateColumns: SUB_COLS }}>
            {["Form", "Client", "Submitted by", "Received", ""].map((h, i) => (
              <span key={i} className={i === 2 ? "cell-by-head" : i === 3 ? "cell-at-head" : undefined}
                style={{
                  fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: 11,
                  fontWeight: 600, letterSpacing: "0.1em", color: "var(--text-quiet)",
                }}>{h}</span>
            ))}
          </div>

          {filtered.map((s) => {
            const stamp = STATUS_STAMP[s.status] || ["neutral", s.status || "—"];
            return (
              <div
                key={s.id}
                className="ledger-row"
                style={{ gridTemplateColumns: SUB_COLS, cursor: "pointer" }}
                onClick={() => onView && onView(s)}
              >
                <span style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.008em" }}>
                  {s.templateName || s.schemaKey}
                </span>
                <span style={{ fontSize: 14.5, color: "var(--text-secondary)" }}>{s.clientName || "—"}</span>
                <span className="cell-by" style={{ alignItems: "center", gap: 9, fontSize: 14, color: "var(--text-secondary)" }}>
                  {s.caregiverName ? <Avatar name={s.caregiverName} size={24} role="caregiver" /> : null}
                  {s.caregiverName || "—"}
                </span>
                <span className="cell-at" style={{
                  fontFamily: "var(--font-figure)", fontSize: 13.5, letterSpacing: "0.02em",
                  fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)", whiteSpace: "nowrap",
                }}>{relTime(s.submittedAt)}</span>
                <span style={{ justifySelf: "end" }}><Stamp tone={stamp[0]}>{stamp[1]}</Stamp></span>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ borderTop: "1px solid var(--border-hair)", padding: "36px 4px", color: "var(--text-secondary)", fontSize: 15 }}>
              {all.length === 0 ? "No forms have been filed yet." : "Nothing matches those filters."}
            </div>
          )}
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {oldestOpen && (
            <Panel label="Waiting longest" tone="accent">
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500,
                letterSpacing: "-0.02em", color: "var(--green-900)",
              }}>{oldestOpen.templateName || oldestOpen.schemaKey}</div>
              <div style={{ fontSize: 14, color: "var(--green-900)", opacity: .78, marginTop: 6 }}>
                {(oldestOpen.caregiverName || "—") + " · " + relTime(oldestOpen.submittedAt)}
              </div>
              <div style={{ marginTop: 16 }}>
                <Button size="sm" onClick={() => onView && onView(oldestOpen)}>Open submission</Button>
              </div>
            </Panel>
          )}

          <Panel label="Ledger totals">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["Reviewed", reviewed.length],
                ["Sent for correction", needsCorrection.length],
                ["Still open", open.length],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14 }}>
                  <span style={{ fontSize: 14.5, color: "var(--text-secondary)" }}>{k}</span>
                  <span style={{
                    fontFamily: "var(--font-figure)", fontSize: 20, fontWeight: 500,
                    fontVariantNumeric: "tabular-nums", color: "var(--text-brand)",
                  }}>{v}</span>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

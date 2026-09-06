// The office/admin dashboard, rebuilt from the design kit's LedgerDashboard.
//
// The kit screen was a static mock with invented figures. This keeps its layout
// and typography exactly, and replaces every number and row with live data from
// the store. Where the kit showed something the app has no source for, the
// section is dropped rather than faked — a dashboard carrying one plausible
// invented figure is worse than one carrying none, because from the outside
// nobody can tell which of the numbers is real.

import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon, Button, Stamp, MonoLabel, Avatar } from "../design/index.js";
import { SheetHeader } from "./Chrome.jsx";
import { useStore } from "./useStore.js";

const COLS = "minmax(120px,1.6fr) minmax(90px,1.1fr) minmax(90px,1fr) max-content 156px";

// Sentence case throughout, per the design system's casing rule.
const STATUS_STAMP = {
  submitted: ["info", "Submitted"],
  reviewed: ["ok", "Reviewed"],
  needsCorrection: ["warn", "Needs correction"],
};

const relTime = (iso) => {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");

/** Zero-pads small counts so "06" holds the same width as "14" as it changes. */
const pad2 = (n) => String(n).padStart(2, "0");

function MetricRail({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16, margin: "0 0 44px" }}>
      {items.map((m) => (
        <div key={m.label} className="metric" style={{
          background: "var(--white)", border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-panel)", padding: "18px 20px 20px",
        }}>
          <span className="edge" style={{ background: m.alert ? "var(--warning-fg)" : "var(--brand-primary)" }} />
          <div style={{
            fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: 11, fontWeight: 600,
            letterSpacing: "0.11em", color: m.alert ? "var(--warning-fg)" : "var(--text-secondary)",
          }}>{m.label}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
            <span style={{
              fontFamily: "var(--font-figure)", fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em",
              fontWeight: 500, fontVariantNumeric: "tabular-nums",
              color: m.alert ? "var(--warning-fg)" : "var(--text-brand)",
            }}>{m.value}</span>
            {m.unit ? (
              <span style={{
                fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: 11,
                fontWeight: 600, letterSpacing: "0.1em", color: "var(--text-quiet)",
              }}>{m.unit}</span>
            ) : null}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>{m.note}</div>
          <span className="fig-underline" />
        </div>
      ))}
    </div>
  );
}

export function ConsoleDashboard({ basePath = "/admin" }) {
  const Store = useStore();
  const navigate = useNavigate();

  const submissions = Store.getSubmissions().filter((s) => !s.deletedAt);
  const clients = Store.clients;
  const inbound = Store.getPendingInbound();
  const applications = Store.getPendingApplications();

  const pendingReview = submissions.filter((s) => s.status === "submitted");
  const needsCorrection = submissions.filter((s) => s.status === "needsCorrection");

  const oldestPending = pendingReview.map((s) => s.submittedAt).filter(Boolean).sort()[0];

  const recent = submissions
    .slice()
    .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")))
    .slice(0, 8);

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  // States what is actually waiting, in the brand's voice: plainspoken and
  // specific, and quiet rather than congratulatory when there is nothing to do.
  const waiting = [];
  if (pendingReview.length) waiting.push(plural(pendingReview.length, "submission") + " waiting on review");
  if (inbound.length) waiting.push(plural(inbound.length, "inbound document") + " to file");
  if (applications.length) waiting.push(plural(applications.length, "application") + " to look at");
  const lead = waiting.length
    ? waiting.join(", ").replace(/, ([^,]*)$/, " and $1") + "."
    : "Nothing is waiting on you right now.";

  return (
    <>
      <img className="watermark" src="/brand/assets/mark-leaf.png" alt="" />

      <SheetHeader
        eyebrow="Office manager / Dashboard"
        title={today}
        lead={lead}
        actions={
          <Button iconLeft={<Icon name="plus" size={16} />} onClick={() => navigate(basePath + "/clients")}>
            Add client
          </Button>
        }
      />

      <MetricRail items={[
        {
          label: "Pending review",
          value: pad2(pendingReview.length),
          note: oldestPending ? "Oldest waiting since " + relTime(oldestPending) : "Nothing waiting",
          alert: pendingReview.length > 0,
        },
        {
          label: "Inbound to file",
          value: pad2(inbound.length),
          note: inbound.length ? "Waiting on a filing decision" : "Queue is clear",
        },
        {
          label: "Open applications",
          value: pad2(applications.length),
          note: applications.length ? "Submitted from the careers site" : "None open",
        },
        {
          label: "Clients",
          value: String(clients.length),
          note: plural(submissions.length, "form") + " filed in total",
        },
      ]} />

      <div className="split" style={{ alignItems: "start" }}>
        <section>
          <MonoLabel rule count={submissions.length} style={{ marginBottom: 4 }}>Submissions ledger</MonoLabel>

          <div className="ledger-head" style={{ gridTemplateColumns: COLS }}>
            {["Form", "Client", "Submitted by", "Received", ""].map((h, i) => (
              <span key={i} className={i === 2 ? "cell-by-head" : i === 3 ? "cell-at-head" : undefined}
                style={{
                  fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: 11,
                  fontWeight: 600, letterSpacing: "0.1em", color: "var(--text-quiet)",
                }}>{h}</span>
            ))}
          </div>

          {recent.length === 0 ? (
            <div style={{ padding: "28px 6px", color: "var(--text-muted)", fontSize: 14.5 }}>
              No forms have been filed yet.
            </div>
          ) : recent.map((s) => {
            const stamp = STATUS_STAMP[s.status] || ["info", s.status || "—"];
            return (
              <div key={s.id} className="ledger-row" style={{ gridTemplateColumns: COLS }}>
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
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          {needsCorrection.length > 0 && (
            <section>
              <MonoLabel rule style={{ marginBottom: 16 }}>Sent back for correction</MonoLabel>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {needsCorrection.slice(0, 5).map((s, i) => (
                  <div key={s.id} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 2px",
                    borderTop: i ? "1px solid var(--border-hair)" : "none",
                  }}>
                    <span style={{ width: 3, alignSelf: "stretch", background: "var(--warning-fg)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{s.templateName || s.schemaKey}</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                        {(s.caregiverName || "—") + (s.clientName ? " · " + s.clientName : "")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <MonoLabel rule count={clients.length} style={{ marginBottom: 16 }}>Client directory</MonoLabel>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {clients.slice(0, 6).map((c, i) => (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", gap: 11, padding: "11px 2px",
                  borderTop: i ? "1px solid var(--border-hair)" : "none",
                }}>
                  <Avatar name={c.name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    {c.city ? <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>{c.city}</div> : null}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <Button variant="outline" size="sm" fullWidth onClick={() => navigate(basePath + "/clients")}>
                All clients
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

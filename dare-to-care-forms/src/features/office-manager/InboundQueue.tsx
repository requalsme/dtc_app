// ── InboundQueue ───────────────────────────────────────────────────────────
//
// Everything that arrives from outside the app lands here first: emailed DCSC
// authorizations and start-of-care forms, certification and background-check
// results, imported GoFormz records. The ingestion function proposes who each
// document belongs to. This screen is where a person decides.
//
// The design rule throughout: the machine's suggestion is visible, explained,
// and never pre-committed unless it is a full-name match. A surname and an
// initial is not an identification — Debra Hardman is a client and Dean
// Hardman is a caregiver, and "D Hardman" is genuinely both. Filing that to
// the wrong one doesn't just misplace a document, it puts a client's
// authorization in a staff file.
//
// Work is ordered hardest-first. The entries a reviewer has to think about sit
// above the ones that only need a confirming click, because a queue sorted
// newest-first trains people to click through the top of it without reading.

import { useMemo, useState } from "react";
// @ts-ignore
import { Icon } from "../../components/fields.jsx";
// @ts-ignore
import { DTCStore as Store } from "../../components/store.js";
import { fmtDate } from "../../utils/format";

type Confidence = "confident" | "weak" | "ambiguous" | "unmatched";

type Candidate = {
  id: string;
  name: string;
  subjectType: "client" | "staff";
  score: number;
  reasons: string[];
};

type InboundEntry = {
  id: string;
  source: string;
  fileName?: string;
  subject?: string | null;
  from?: string | null;
  receivedAt?: string;
  queuedAt?: string;
  docType: string;
  docLabel: string;
  nameText?: string;
  confidence: Confidence;
  matchNote?: string;
  candidates?: Candidate[];
  sourceUrl?: string | null;
};

// How each confidence level should read to someone working the queue. The
// wording matters more than the colour: "needs a decision" and "confirm this"
// are different jobs, and the label is what tells them apart.
const CONFIDENCE: Record<Confidence, { label: string; cls: string; blurb: string }> = {
  ambiguous: {
    label: "Needs a decision",
    cls: "warn",
    blurb: "More than one person fits. Nothing is pre-selected on purpose.",
  },
  unmatched: {
    label: "No match",
    cls: "",
    blurb: "Nobody on either roster fits. This may be a former client or a former member of staff — their records still have to be kept.",
  },
  weak: {
    label: "Confirm",
    cls: "warn",
    blurb: "A partial match. Check the document before filing it.",
  },
  confident: {
    label: "Ready",
    cls: "ok",
    blurb: "Full name match. Still needs your click.",
  },
};

const ORDER: Confidence[] = ["ambiguous", "unmatched", "weak", "confident"];

// ── One entry ───────────────────────────────────────────────────────────────

function QueueRow({ entry, onToast }: { entry: InboundEntry; onToast: (m: string) => void }) {
  const candidates = entry.candidates || [];

  // Only a full-name match arrives pre-selected. Everything else starts empty,
  // so filing it is a deliberate act rather than an accepted default.
  const [choice, setChoice] = useState<string>(
    entry.confidence === "confident" && candidates[0]
      ? `${candidates[0].subjectType}:${candidates[0].id}`
      : "",
  );
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const roster = useMemo(() => (showAll ? Store.rosterForFiling() : []), [showAll]);

  const meta = CONFIDENCE[entry.confidence] || CONFIDENCE.weak;

  const file = async () => {
    if (!choice) return;
    const [subjectType, subjectId] = choice.split(":");
    setBusy(true);
    setError("");
    try {
      const res = await Store.resolveInbound(entry.id, subjectType, subjectId);
      onToast(`Filed to ${res.subjectName}`);
    } catch (err: any) {
      setError(err?.message || "Could not file that document.");
      setBusy(false);
    }
  };

  const dismiss = async () => {
    if (!reason.trim()) {
      setError("Say why, so the next person doesn't have to work it out.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await Store.dismissInbound(entry.id, reason.trim());
      onToast("Dismissed");
    } catch (err: any) {
      setError(err?.message || "Could not dismiss that document.");
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      {/* What arrived */}
      <div className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <span className="si"><Icon n="file" s={18} /></span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {entry.docLabel}
            <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>
              {" · "}{entry.fileName || "untitled"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
            {entry.from ? `From ${entry.from}` : `Imported from ${entry.source}`}
            {entry.receivedAt ? ` · ${fmtDate(String(entry.receivedAt).slice(0, 10))}` : ""}
          </div>
          {entry.subject && (
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
              “{entry.subject}”
            </div>
          )}
        </div>
        <span className={`stat ${meta.cls}`}>{meta.label}</span>
        {entry.sourceUrl && (
          <a
            className="dbtn dbtn-ghost"
            href={entry.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none" }}
          >
            <Icon n="eye" s={14} /> Open
          </a>
        )}
      </div>

      {/* Why the machine thinks what it thinks */}
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-2)",
          background: "var(--bg-2, rgba(0,0,0,0.02))",
          borderRadius: 6,
          padding: "8px 10px",
          margin: "12px 0",
        }}
      >
        {entry.matchNote || meta.blurb}
      </div>

      {/* Who it might belong to */}
      {candidates.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {candidates.map((c) => {
            const value = `${c.subjectType}:${c.id}`;
            return (
              <label
                key={value}
                className="subrow"
                style={{ cursor: "pointer", alignItems: "flex-start", gap: 10 }}
              >
                <input
                  type="radio"
                  name={`who-${entry.id}`}
                  checked={choice === value}
                  onChange={() => { setChoice(value); setError(""); }}
                  style={{ marginTop: 3 }}
                />
                <span className="sinfo">
                  <span className="nm">
                    {c.name}
                    {/* Which filing cabinet, said plainly. This is the part
                        that is expensive to get wrong. */}
                    <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>
                      {c.subjectType === "client" ? " · client file" : " · staff file"}
                    </span>
                  </span>
                  <span className="meta">{c.reasons.join("; ")}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* The escape hatch: anyone on either roster */}
      {!showAll ? (
        <button
          className="dbtn dbtn-ghost"
          onClick={() => setShowAll(true)}
          style={{ fontSize: 12.5 }}
        >
          {candidates.length ? "Someone else…" : "Choose who this belongs to…"}
        </button>
      ) : (
        <select
          className="input"
          value={choice}
          onChange={(e) => { setChoice(e.target.value); setError(""); }}
          style={{ maxWidth: 380 }}
        >
          <option value="">Choose a person…</option>
          <optgroup label="Clients">
            {roster
              .filter((p: any) => p.subjectType === "client")
              .map((p: any) => (
                <option key={`client:${p.id}`} value={`client:${p.id}`}>{p.name}</option>
              ))}
          </optgroup>
          <optgroup label="Staff">
            {roster
              .filter((p: any) => p.subjectType === "staff")
              .map((p: any) => (
                <option key={`staff:${p.id}`} value={`staff:${p.id}`}>
                  {p.name}{p.detail ? ` — ${p.detail}` : ""}
                </option>
              ))}
          </optgroup>
        </select>
      )}

      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}

      {/* Actions */}
      <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button className="dbtn dbtn-primary" disabled={!choice || busy} onClick={file}>
          <Icon n="check" s={14} /> {busy ? "Filing…" : "File this document"}
        </button>
        {!dismissing ? (
          <button className="dbtn dbtn-ghost" disabled={busy} onClick={() => setDismissing(true)}>
            Not a record
          </button>
        ) : (
          <>
            <input
              className="input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Why isn't this a record?"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(""); }}
              autoFocus
            />
            <button className="dbtn dbtn-warn" disabled={busy} onClick={dismiss}>
              Dismiss
            </button>
            <button className="dbtn dbtn-ghost" disabled={busy} onClick={() => { setDismissing(false); setReason(""); }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── The queue ───────────────────────────────────────────────────────────────

export function InboundQueue({ onToast }: { onToast: (m: string) => void }) {
  const [filter, setFilter] = useState<Confidence | "all">("all");

  const pending: InboundEntry[] = Store.getPendingInbound();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: pending.length };
    for (const level of ORDER) c[level] = pending.filter((e) => e.confidence === level).length;
    return c;
  }, [pending]);

  const shown = filter === "all" ? pending : pending.filter((e) => e.confidence === filter);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Inbound documents</h2>
        <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "6px 0 0", maxWidth: 620 }}>
          Documents that arrived by email or were imported, waiting to be filed. Nothing here is
          on anyone's record yet, and nobody is marked compliant until you file it.
        </p>
      </div>

      {/* Filters double as a summary — how much of the queue is real work. */}
      <div className="row" style={{ gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          className={`dbtn ${filter === "all" ? "dbtn-primary" : "dbtn-ghost"}`}
          onClick={() => setFilter("all")}
        >
          All {counts.all}
        </button>
        {ORDER.filter((level) => counts[level] > 0).map((level) => (
          <button
            key={level}
            className={`dbtn ${filter === level ? "dbtn-primary" : "dbtn-ghost"}`}
            onClick={() => setFilter(level)}
          >
            {CONFIDENCE[level].label} {counts[level]}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
          {pending.length === 0
            ? "Nothing waiting. Documents arriving in the DTC inbox will show up here."
            : "Nothing in this category."}
        </div>
      ) : (
        shown.map((entry) => <QueueRow key={entry.id} entry={entry} onToast={onToast} />)
      )}
    </div>
  );
}

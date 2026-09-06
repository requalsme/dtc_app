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
// Work is ordered hardest-first (the sort lives in Store.getPendingInbound).
// The entries a reviewer has to think about sit above the ones that only need
// a confirming click, because a queue sorted newest-first trains people to
// click through the top of it without reading.

import { useMemo, useState } from "react";
// @ts-ignore
import { DTCStore as Store } from "../../components/store.js";
import { fmtDate } from "../../utils/format";
import {
  Icon, Button, Stamp, Panel, Input, Select, Radio,
  EmptyState, Chip, Text,
  // @ts-ignore - design system is untyped JSX
} from "../../design/index.js";
// @ts-ignore - untyped JSX
import { SheetHeader, useAreaLabel } from "../../console/Chrome.jsx";

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
const CONFIDENCE: Record<Confidence, { label: string; tone: string; blurb: string }> = {
  ambiguous: {
    label: "Needs a decision",
    tone: "warning",
    blurb: "More than one person fits. Nothing is pre-selected on purpose.",
  },
  unmatched: {
    label: "No match",
    tone: "neutral",
    blurb: "Nobody on either roster fits. This may be a former client or a former member of staff — their records still have to be kept.",
  },
  weak: {
    label: "Confirm",
    tone: "warning",
    blurb: "A partial match. Check the document before filing it.",
  },
  confident: {
    label: "Ready",
    tone: "success",
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
    <Panel padding={20} accentEdge={entry.confidence === "ambiguous"} style={{ marginBottom: 12 }}>
      {/* What arrived */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{
          display: "grid", placeItems: "center", width: 34, height: 34, flex: "0 0 auto",
          borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", color: "var(--text-secondary)",
        }}>
          <Icon name="file" size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-body)" }}>
            {entry.docLabel}
            <span style={{ color: "var(--text-quiet)", fontWeight: 400 }}>
              {" · "}{entry.fileName || "untitled"}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-quiet)", marginTop: 3 }}>
            {entry.from ? `From ${entry.from}` : `Imported from ${entry.source}`}
            {entry.receivedAt ? ` · ${fmtDate(String(entry.receivedAt).slice(0, 10))}` : ""}
          </div>
          {entry.subject && (
            <div style={{ fontSize: 12.5, color: "var(--text-quiet)", marginTop: 3, fontStyle: "italic" }}>
              “{entry.subject}”
            </div>
          )}
        </div>
        <Stamp tone={meta.tone}>{meta.label}</Stamp>
        {entry.sourceUrl && (
          <Button size="sm" variant="ghost" iconLeft={<Icon name="eye" size={15} />}
            onClick={() => window.open(entry.sourceUrl!, "_blank", "noopener")}>
            Open
          </Button>
        )}
      </div>

      {/* Why the machine thinks what it thinks. Shown always, not on demand:
          a suggestion whose reasoning is hidden gets trusted by default. */}
      <Panel tone="sunken" padding={12} style={{ marginBottom: 16 }}>
        <Text role="body" color="secondary" style={{ fontSize: 13, lineHeight: 1.55 }}>
          {entry.matchNote || meta.blurb}
        </Text>
      </Panel>

      {/* Who it might belong to */}
      {candidates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {candidates.map((c) => {
            const value = `${c.subjectType}:${c.id}`;
            return (
              <Radio
                key={value}
                name={`who-${entry.id}`}
                value={value}
                checked={choice === value}
                onChange={() => { setChoice(value); setError(""); }}
                label={
                  <>
                    {c.name}
                    {/* Which filing cabinet, said plainly. This is the part
                        that is expensive to get wrong. */}
                    <span style={{ color: "var(--text-quiet)", fontWeight: 400 }}>
                      {c.subjectType === "client" ? " · client file" : " · staff file"}
                    </span>
                  </>
                }
                description={c.reasons.join("; ")}
              />
            );
          })}
        </div>
      )}

      {/* The escape hatch: anyone on either roster */}
      {!showAll ? (
        <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>
          {candidates.length ? "Someone else…" : "Choose who this belongs to…"}
        </Button>
      ) : (
        <div style={{ maxWidth: 400 }}>
          <Select
            label="File this to"
            value={choice}
            onChange={(e: any) => { setChoice(e.target.value); setError(""); }}
          >
            <option value="">Choose a person…</option>
            <optgroup label="Clients">
              {roster.filter((p: any) => p.subjectType === "client").map((p: any) => (
                <option key={`client:${p.id}`} value={`client:${p.id}`}>{p.name}</option>
              ))}
            </optgroup>
            <optgroup label="Staff">
              {roster.filter((p: any) => p.subjectType === "staff").map((p: any) => (
                <option key={`staff:${p.id}`} value={`staff:${p.id}`}>
                  {p.name}{p.detail ? ` — ${p.detail}` : ""}
                </option>
              ))}
            </optgroup>
          </Select>
        </div>
      )}

      {error && (
        <Text role="body" style={{ display: "block", fontSize: 12.5, color: "var(--status-danger)", marginTop: 10 }}>
          {error}
        </Text>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
        <Button disabled={!choice || busy} iconLeft={<Icon name="check" size={16} />} onClick={file}>
          {busy ? "Filing…" : "File this document"}
        </Button>
        {!dismissing ? (
          <Button variant="ghost" disabled={busy} onClick={() => setDismissing(true)}>
            Not a record
          </Button>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Input
                placeholder="Why isn't this a record?"
                value={reason}
                onChange={(e: any) => { setReason(e.target.value); setError(""); }}
                autoFocus
              />
            </div>
            <Button variant="danger" disabled={busy} onClick={dismiss}>Dismiss</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setDismissing(false); setReason(""); }}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
}

// ── The queue ───────────────────────────────────────────────────────────────

export function InboundQueue({ onToast }: { onToast: (m: string) => void }) {
  const area = useAreaLabel();
  const [filter, setFilter] = useState<Confidence | "all">("all");

  const pending: InboundEntry[] = Store.getPendingInbound();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: pending.length };
    for (const level of ORDER) c[level] = pending.filter((e) => e.confidence === level).length;
    return c;
  }, [pending]);

  const shown = filter === "all" ? pending : pending.filter((e) => e.confidence === filter);
  const needsThought = counts.ambiguous + counts.unmatched;

  return (
    <>
      <SheetHeader
        eyebrow={`${area} / Inbound`}
        title="Inbound documents"
        lead="Documents that arrived by email or were imported, waiting to be filed. Nothing here is on anyone's record yet, and nobody is marked compliant until you file it."
      />

      {/* Filters double as a summary — how much of the queue is real work. */}
      <div style={{ display: "flex", gap: 8, marginBottom: 26, flexWrap: "wrap", alignItems: "center" }}>
        <Button
          size="sm"
          variant={filter === "all" ? "secondary" : "outline"}
          onClick={() => setFilter("all")}
        >
          All {counts.all}
        </Button>
        {ORDER.filter((level) => counts[level] > 0).map((level) => (
          <Button
            key={level}
            size="sm"
            variant={filter === level ? "secondary" : "outline"}
            onClick={() => setFilter(level)}
          >
            {CONFIDENCE[level].label} {counts[level]}
          </Button>
        ))}
        <span style={{ flex: 1 }} />
        {needsThought > 0 && (
          <Chip icon={<Icon name="alert" size={14} />}>
            {needsThought} {needsThought === 1 ? "needs" : "need"} a real decision
          </Chip>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={pending.length === 0 ? "Nothing waiting" : "Nothing in this category"}
          description={pending.length === 0
            ? "Documents arriving in the DTC inbox will show up here to be filed."
            : "Clear the filter to see the rest of the queue."}
        />
      ) : (
        <div style={{ maxWidth: 880 }}>
          {shown.map((entry) => <QueueRow key={entry.id} entry={entry} onToast={onToast} />)}
        </div>
      )}
    </>
  );
}

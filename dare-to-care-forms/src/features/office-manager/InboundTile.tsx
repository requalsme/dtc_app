// ── InboundTile ────────────────────────────────────────────────────────────
//
// The review queue, compressed to something that fits on a dashboard.
//
// It exists because the queue only works if someone looks at it. Documents
// arriving from outside the app are the agency's only compliance evidence —
// CareTime holds zero documents for all 50 people on the roster — and a queue
// nobody opens is the same as no queue at all. So the count comes to the
// dashboard rather than waiting behind a nav link.
//
// Two things it deliberately does not do:
//
//  1. **It never files anything.** Filing needs the source document open in
//     front of you, and there is no room for that here. Every action leads to
//     the full queue. A one-click "accept" on a dashboard is exactly how a
//     client's authorization ends up in a caregiver's personnel file.
//
//  2. **It leads with the work that needs thinking about**, not the total.
//     "14 waiting" reads as a backlog to clear. "6 need a decision" is the
//     honest number, and it's the one that should pull someone in.
//
// Self-contained on purpose: it takes its own data from the store and needs
// only an optional `onOpen`. Drop it on any screen — the office dashboard, an
// admin overview, a future standalone page — without wiring anything up.

import { useEffect, useMemo, useState } from "react";
// @ts-ignore
import { Icon } from "../../components/fields";
// @ts-ignore
import { DTCStore as Store } from "../../components/store";

type Confidence = "confident" | "weak" | "ambiguous" | "unmatched";

// Same order and the same words as the full queue. A tile that renamed these
// would teach people one vocabulary and then hand them another.
const ORDER: Confidence[] = ["ambiguous", "unmatched", "weak", "confident"];

const LABEL: Record<Confidence, string> = {
  ambiguous: "Needs a decision",
  unmatched: "No match",
  weak: "Confirm",
  confident: "Ready",
};

const TONE: Record<Confidence, string> = {
  ambiguous: "warn",
  unmatched: "",
  weak: "warn",
  confident: "ok",
};

export function InboundTile({
  onOpen,
  limit = 3,
}: {
  onOpen?: () => void;
  limit?: number;
}) {
  const [pending, setPending] = useState<any[]>(() => Store.getPendingInbound());

  // The poll runs every 15 minutes, so this screen is often open when new work
  // lands. Subscribing means the count is current without anyone refreshing.
  useEffect(() => Store.subscribe(() => setPending(Store.getPendingInbound())), []);

  const counts = useMemo(() => {
    const c = { ambiguous: 0, unmatched: 0, weak: 0, confident: 0 } as Record<Confidence, number>;
    for (const e of pending) if (e.confidence in c) c[e.confidence as Confidence]++;
    return c;
  }, [pending]);

  // getPendingInbound already sorts hardest-first, so the head of the list is
  // the work that matters. No second sort here — one ordering, defined once.
  const preview = pending.slice(0, limit);
  const needsThought = counts.ambiguous + counts.unmatched + counts.weak;

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h3>
            <Icon n="inbox" s={15} /> Inbound documents
          </h3>
          <p>
            {pending.length === 0
              ? "Nothing waiting to be filed."
              : needsThought > 0
                ? `${needsThought} need a person to decide · ${counts.confident} ready to confirm`
                : `${counts.confident} ready to confirm`}
          </p>
        </div>
        {pending.length > 0 && onOpen && (
          <button className="dbtn dbtn-ghost" onClick={onOpen}>
            Open queue
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="admin-empty-inline">
          Documents arriving in the DTC inbox will show up here.
        </div>
      ) : (
        <>
          {/* The breakdown, not just a total. Which kind of work is waiting
              changes whether it's a five-minute job or an afternoon. */}
          <div className="row" style={{ gap: 6, flexWrap: "wrap", padding: "0 0 12px" }}>
            {ORDER.filter((level) => counts[level] > 0).map((level) => (
              <span key={level} className={`stat ${TONE[level]}`}>
                {LABEL[level]} {counts[level]}
              </span>
            ))}
          </div>

          <div className="admin-queue-list">
            {preview.map((e) => {
              const top = e.candidates?.[0];
              return (
                <div className="admin-queue-row" key={e.id}>
                  <div>
                    <strong>{e.docLabel || "Unclassified"}</strong>
                    <span>
                      {e.fileName || "untitled"}
                      {/* Which filing cabinet it would go in, said plainly.
                          "Debra Hardman · client" and "Dean Hardman · staff"
                          are the same nine letters and two different files. */}
                      {top ? ` · ${top.name} (${top.subjectType})` : " · nobody matched"}
                    </span>
                  </div>
                  <span className={`ui-tag${TONE[e.confidence as Confidence] === "warn" ? " warn" : ""}`}>
                    {LABEL[e.confidence as Confidence] || "Review"}
                  </span>
                </div>
              );
            })}
          </div>

          {pending.length > preview.length && onOpen && (
            <button
              className="dbtn dbtn-ghost"
              onClick={onOpen}
              style={{ marginTop: 10, fontSize: 12.5 }}
            >
              {pending.length - preview.length} more waiting →
            </button>
          )}

          {/* Said on the dashboard rather than only inside the queue, because
              this is the screen someone glances at and forms an impression
              from. Nothing here is on anyone's record yet. */}
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "12px 0 0" }}>
            Nothing here is on anyone's record, and nobody is marked compliant, until it's filed.
          </p>
        </>
      )}
    </section>
  );
}

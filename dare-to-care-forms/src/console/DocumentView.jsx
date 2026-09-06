// The scanned page, with what the app read off it drawn on top.
//
// WHY THIS EXISTS
// A form in this app has two lives. There is the record — the fields and their
// values, which is what every list, checklist and export reads. And there is
// the document — the actual page a person signed, which is what a surveyor
// asks for and what carries a real signature or initials from before this
// system existed.
//
// Showing only the record loses the signature. Showing only the scan means
// nobody can read the data without squinting at a photograph. So both are
// shown at once: the page underneath, and each captured value pinned over the
// box it came from, with a toggle to take the overlay away and look at the
// original clean.
//
// Positions come from the PDF's own widget rectangles, captured at import and
// stored as fractions of the page, so they land correctly at any zoom.
//
// When there is no scan — a form filled in the app rather than imported from
// paper — this falls back to a plain reading view. That is the common case and
// it should not look like a degraded version of anything.

import React from "react";
import { Icon, Button, IconButton, MonoLabel, Panel, Stamp, EmptyState, Chip } from "../design/index.js";
import { signedUrl, BUCKETS } from "../lib/db.js";

/** Every field across every section, flattened, with its section for context. */
function allFields(template) {
  return (template?.sections || []).flatMap((section) =>
    (section.fields || []).map((f) => ({ ...f, sectionTitle: section.title })),
  );
}

const displayValue = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (typeof v === "object") return null;
  return String(v);
};

/**
 * One captured value, pinned over the box it was read from.
 *
 * Sits at 88% opacity on pale mint rather than fully solid: the point is to
 * read the value AND see that it lines up with the original box underneath.
 * A solid chip would hide exactly the evidence it is annotating.
 */
function ValuePin({ field, value, active, onEnter, onLeave }) {
  const r = field.rect;
  if (!r) return null;
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      title={field.label + (value ? ": " + value : "")}
      style={{
        position: "absolute",
        left: r.x * 100 + "%",
        top: r.y * 100 + "%",
        width: r.w * 100 + "%",
        height: r.h * 100 + "%",
        minHeight: 16,
        display: "flex",
        alignItems: "center",
        padding: "0 5px",
        borderRadius: "var(--radius-sm)",
        background: active ? "var(--green-200)" : "rgba(203,225,202,.88)",
        boxShadow: "inset 0 0 0 1px " + (active ? "var(--brand-primary)" : "var(--border-brand)"),
        color: "var(--green-900)",
        fontFamily: "var(--font-ui)",
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: 1.1,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        cursor: "default",
        transition: "background var(--duration-fast) var(--ease-standard)",
      }}
    >
      {value || <span style={{ opacity: .55, fontWeight: 500 }}>{field.label}</span>}
    </div>
  );
}

/**
 * @param {object}  template   the form definition, carrying field rects
 * @param {object}  values     fieldId -> captured value (optional)
 * @param {string}  sourcePath storage path of the scan, if there is one
 */
export function DocumentView({ template, values = {}, sourcePath }) {
  const [pageUrl, setPageUrl] = React.useState(null);
  const [loading, setLoading] = React.useState(!!sourcePath);
  const [showOverlay, setShowOverlay] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [hovered, setHovered] = React.useState(null);

  const fields = allFields(template);
  const pageCount = Math.max(1, template?.sourcePages || 1);
  const positioned = fields.filter((f) => f.rect && (f.page ?? 0) === page);
  // Fields the PDF gave no geometry for. Listed rather than dropped, so the
  // reading panel is never quietly missing something the record contains.
  const unpositioned = fields.filter((f) => !f.rect);

  React.useEffect(() => {
    let cancelled = false;
    if (!sourcePath) { setLoading(false); return; }
    signedUrl(BUCKETS.filed, sourcePath, 3600).then((url) => {
      if (cancelled) return;
      setPageUrl(url);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [sourcePath]);

  // No scan: the record is the whole document. This is the ordinary case for a
  // form filled in the app, so it reads as a normal record view, not a
  // fallback.
  if (!sourcePath) {
    return (
      <ReadingPanel
        template={template}
        fields={fields}
        values={values}
        note="Filled in the app — there is no paper original for this one."
      />
    );
  }

  return (
    <div className="split" style={{ alignItems: "start" }}>
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <MonoLabel rule style={{ flex: 1 }}>Scanned document</MonoLabel>
          {pageCount > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IconButton icon={<Icon name="arrowLeft" size={15} />} label="Previous page" size="sm"
                disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
              <span style={{
                fontFamily: "var(--font-figure)", fontSize: 13,
                fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)",
              }}>{page + 1} / {pageCount}</span>
              <IconButton icon={<Icon name="chevron" size={15} />} label="Next page" size="sm"
                disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} />
            </div>
          )}
          <Button
            size="sm"
            variant={showOverlay ? "secondary" : "outline"}
            iconLeft={<Icon name="eye" size={15} />}
            onClick={() => setShowOverlay((v) => !v)}
          >
            {showOverlay ? "Hide values" : "Show values"}
          </Button>
        </div>

        <div style={{
          position: "relative",
          borderRadius: "var(--radius-panel)",
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-card)",
          overflow: "hidden",
          minHeight: 320,
        }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: "var(--text-secondary)" }}>Loading the document…</div>
          ) : pageUrl ? (
            <>
              {/* The page itself. An <object> renders a PDF inline in every
                  current browser without pulling a viewer library in. */}
              <object data={pageUrl + "#page=" + (page + 1)} type="application/pdf"
                style={{ width: "100%", height: 760, display: "block", border: 0 }}>
                <div style={{ padding: 40, textAlign: "center" }}>
                  <p style={{ color: "var(--text-secondary)" }}>This browser can't show the PDF inline.</p>
                  <Button onClick={() => window.open(pageUrl, "_blank", "noopener")}>Open the document</Button>
                </div>
              </object>

              {/* Values are pinned over a transparent layer above the page.
                  pointer-events are off on the layer so scrolling and text
                  selection in the PDF still work, and back on for each pin so
                  hovering one still highlights its row. */}
              {showOverlay && positioned.length > 0 && (
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  <div style={{ position: "relative", width: "100%", height: 760 }}>
                    {positioned.map((f) => (
                      <div key={f.id} style={{ pointerEvents: "auto" }}>
                        <ValuePin
                          field={f}
                          value={displayValue(values[f.id])}
                          active={hovered === f.id}
                          onEnter={() => setHovered(f.id)}
                          onLeave={() => setHovered(null)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="The document couldn't be opened"
              description="The record is still complete — the scan just isn't reachable right now."
            />
          )}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Chip icon={<Icon name="shield" size={13} />}>Original retained</Chip>
          <span style={{ fontSize: 12.5, color: "var(--text-quiet)" }}>
            {positioned.length} of {fields.length} fields are positioned on this page
          </span>
          {pageUrl && (
            <>
              <span style={{ flex: 1 }} />
              <Button size="sm" variant="ghost" iconRight={<Icon name="download" size={15} />}
                onClick={() => window.open(pageUrl, "_blank", "noopener")}>
                Open original
              </Button>
            </>
          )}
        </div>
      </section>

      <aside>
        <ReadingPanel
          template={template}
          fields={fields}
          values={values}
          hovered={hovered}
          onHover={setHovered}
          unpositionedCount={unpositioned.length}
          compact
        />
      </aside>
    </div>
  );
}

/** The record as text: every field and what was captured for it. */
function ReadingPanel({ template, fields, values, note, hovered, onHover, unpositionedCount, compact }) {
  const filled = fields.filter((f) => displayValue(values[f.id]) != null);
  const empty = fields.length - filled.length;

  return (
    <div>
      <MonoLabel rule count={fields.length} style={{ marginBottom: 12 }}>
        {compact ? "What was captured" : template?.name || "Record"}
      </MonoLabel>

      {note && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>{note}</div>
      )}

      {fields.length === 0 ? (
        <EmptyState title="No fields" description="This form has no captured fields yet." />
      ) : (
        <Panel padding={0}>
          {fields.map((f, i) => {
            const v = displayValue(values[f.id]);
            const active = hovered === f.id;
            return (
              <div
                key={f.id}
                onMouseEnter={() => onHover && onHover(f.id)}
                onMouseLeave={() => onHover && onHover(null)}
                style={{
                  display: "flex", gap: 12, alignItems: "baseline",
                  padding: "10px 14px",
                  borderTop: i ? "1px solid var(--border-hair)" : "none",
                  background: active ? "var(--state-selected-bg)" : "transparent",
                  transition: "background var(--duration-fast) var(--ease-standard)",
                }}
              >
                <span style={{ flex: "0 0 44%", fontSize: 13, color: "var(--text-secondary)" }}>{f.label}</span>
                <span style={{
                  flex: 1, fontSize: 13.5, fontWeight: v ? 600 : 400,
                  color: v ? "var(--text-body)" : "var(--text-quiet)",
                  wordBreak: "break-word",
                }}>{v || "—"}</span>
                {f.type === "signature" && v && <Stamp tone="success" leaf={false}>Signed</Stamp>}
              </div>
            );
          })}
        </Panel>
      )}

      <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-quiet)", lineHeight: 1.6 }}>
        {filled.length} of {fields.length} captured{empty ? " · " + empty + " left blank" : ""}
        {unpositionedCount ? (
          <>
            <br />
            {unpositionedCount} {unpositionedCount === 1 ? "field has" : "fields have"} no position on the page and appear only here.
          </>
        ) : null}
      </div>
    </div>
  );
}

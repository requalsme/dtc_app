import React from "react";

/** The form-wizard progress ladder: numbered sections down the side (or across
 *  the top on narrow screens), current section marked with a green rule. */
export function Stepper({ steps = [], current = 0, onSelect, orientation = "vertical", style, ...rest }) {
  const vertical = orientation === "vertical";
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: vertical ? 2 : 6, ...style }} {...rest}>
      {steps.map((s, i) => {
        const label = s.label ?? s;
        const done = i < current;
        const active = i === current;
        return (
          <button key={label} onClick={() => onSelect && onSelect(i)}
            style={{
              display: "flex", alignItems: "center", gap: 10, textAlign: "left",
              padding: vertical ? "10px 12px" : "8px 12px", border: 0, cursor: "pointer",
              borderRadius: "var(--radius-control)",
              background: active ? "var(--state-selected-bg)" : "transparent",
              color: active ? "var(--green-900)" : done ? "var(--text-body)" : "var(--text-faint)",
              fontFamily: "var(--font-ui)", fontSize: "var(--text-sm-size)",
              fontWeight: active ? 600 : 500,
            }}>
            <span style={{
              width: 22, height: 22, flex: "0 0 auto", display: "grid", placeItems: "center",
              borderRadius: "var(--radius-hair)",
              background: done ? "var(--green-700)" : active ? "var(--surface-card)" : "transparent",
              border: `1px solid ${done ? "var(--green-700)" : active ? "var(--green-500)" : "var(--border-default)"}`,
              color: done ? "#fff" : "inherit",
              fontFamily: "var(--font-figure)", fontSize: 12, fontWeight: 500, fontVariantNumeric: "tabular-nums",
            }}>
              {done ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg> : String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ flex: 1 }}>{label}</span>
            {active ? <span style={{ width: 18, height: 2, background: "var(--green-700)", borderRadius: 2 }} /> : null}
          </button>
        );
      })}
    </div>
  );
}

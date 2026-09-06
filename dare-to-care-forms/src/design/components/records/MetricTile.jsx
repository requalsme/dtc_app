import React from "react";

/** A dashboard number: mono eyebrow, display numeral, one line of context. */
export function MetricTile({ label, value, unit, note, tone = "default", icon, style, ...rest }) {
  const accent = tone === "accent";
  const alert = tone === "alert";
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: "16px 18px 18px",
      borderRadius: "var(--radius-panel)",
      background: accent ? "var(--surface-accent)" : alert ? "var(--warning-bg)" : "var(--surface-card)",
      border: `1px solid ${accent ? "var(--border-brand)" : alert ? "rgba(180,128,47,.32)" : "var(--border-subtle)"}`,
      fontFamily: "var(--font-ui)", ...style,
    }} {...rest}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: alert ? "var(--warning-fg)" : "var(--text-muted)" }}>
        {icon}
        <span style={{ fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: "var(--text-mono-size)", letterSpacing: "var(--text-mono-ls)" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
        <span style={{ fontFamily: "var(--font-figure)", fontSize: "var(--type-figure-size)", fontWeight: 500, lineHeight: 1, letterSpacing: "var(--type-figure-ls)", fontVariantNumeric: "tabular-nums", color: alert ? "var(--warning-fg)" : "var(--text-brand)" }}>{value}</span>
        {unit ? <span style={{ fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.14em", color: "var(--text-quiet)" }}>{unit}</span> : null}
      </div>
      {note ? <div style={{ marginTop: 8, fontSize: "var(--text-sm-size)", color: "var(--text-muted)" }}>{note}</div> : null}
    </div>
  );
}

import React from "react";

/** Scored-assessment result (fall risk, evaluations): the score set large in
 *  display type, a banded track, and the risk word as a stamp. */
export function ScoreMeter({ label = "Score", value = 0, max = 20, bands = [], style, ...rest }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const band = bands.find((b) => value <= b.upTo) || bands[bands.length - 1];
  const tone = band ? band.tone : "neutral";
  const colors = { success: "var(--success-fg)", warning: "var(--warning-fg)", error: "var(--error-fg)", neutral: "var(--text-muted)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, ...style }} {...rest}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: "var(--text-mono-size)", letterSpacing: "var(--text-mono-ls)", color: "var(--text-muted)" }}>{label}</span>
        <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        {band ? <span style={{ fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: "var(--text-mono-size)", letterSpacing: "var(--text-mono-ls)", color: colors[tone] }}>{band.label}</span> : null}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-figure)", fontSize: 44, fontWeight: 500, lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: colors[tone] }}>{value}</span>
        <span style={{ fontFamily: "var(--font-figure)", fontSize: 15, color: "var(--text-quiet)", paddingBottom: 6 }}>/ {max}</span>
      </div>
      <div style={{ height: 6, borderRadius: "var(--radius-pill)", background: "var(--gray-100)", overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: "var(--radius-pill)", background: colors[tone], transition: "width var(--duration-slow) var(--ease-standard)" }} />
      </div>
    </div>
  );
}

import React from "react";

/** One line of the personnel or client file checklist: required document present,
 *  missing, or expiring. Empty slots read as reserved, not broken. */
export function DocumentSlot({ index, name, state = "missing", meta, action, style, ...rest }) {
  const skins = {
    filed: { color: "var(--success-fg)", border: "var(--border-brand)", bg: "var(--surface-card)", word: "Filed", icon: "check" },
    missing: { color: "var(--text-faint)", border: "var(--border-hair)", bg: "var(--surface-rail)", word: "Missing", icon: "plus" },
    expiring: { color: "var(--warning-fg)", border: "rgba(180,128,47,.3)", bg: "var(--warning-bg)", word: "Expiring", icon: "clock" },
    expired: { color: "var(--error-fg)", border: "rgba(169,80,63,.3)", bg: "var(--error-bg)", word: "Expired", icon: "alert" },
  };
  const s = skins[state];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
      borderRadius: "var(--radius-hair)", background: s.bg,
      border: `1px solid ${s.border}`,
      borderStyle: state === "missing" ? "dashed" : "solid",
      fontFamily: "var(--font-ui)", ...style,
    }} {...rest}>
      {index != null ? <span style={{ fontFamily: "var(--font-figure)", fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "var(--text-quiet)", width: 20 }}>{String(index).padStart(2, "0")}</span> : null}
      <span style={{ flex: 1, fontSize: "var(--text-sm-size)", fontWeight: state === "missing" ? 500 : 600, color: state === "missing" ? "var(--text-muted)" : "var(--text-body)" }}>{name}</span>
      {meta ? <span style={{ fontFamily: "var(--font-figure)", fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{meta}</span> : null}
      <span style={{ fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: "var(--text-mono-size)", letterSpacing: "var(--text-mono-ls)", color: s.color }}>{s.word}</span>
      {action}
    </div>
  );
}

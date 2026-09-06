import React from "react";

/** The house section header:  03 / CARE MANAGEMENT  — rule — supporting line.
 *  Recognisable anatomy; every screen region opens with one. */
export function SectionHeader({ index, label, title, description, actions, tone = "default", style, ...rest }) {
  const inverse = tone === "inverse";
  const metaColor = inverse ? "rgba(241,246,241,.55)" : "var(--text-secondary)";
  return (
    <header style={{ ...style }} {...rest}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {index != null ? (
          <span style={{ fontFamily: "var(--font-figure)", fontSize: 14, fontWeight: 500, letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums", color: inverse ? "var(--green-300)" : "var(--brand-primary)" }}>
            {String(index).padStart(2, "0")}
          </span>
        ) : null}
        {index != null ? <span style={{ width: 1, height: 11, background: inverse ? "var(--border-inverse)" : "var(--border-default)" }} /> : null}
        <span style={{ fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: "var(--type-meta-size)", lineHeight: "var(--type-meta-lh)", letterSpacing: "var(--type-meta-ls)", color: metaColor }}>{label}</span>
        <span style={{ flex: 1, height: 1, background: inverse ? "var(--border-inverse)" : "var(--border-subtle)" }} />
        {actions}
      </div>
      {title ? (
        <h2 style={{
          margin: "16px 0 0", fontFamily: "var(--font-display)", fontWeight: "var(--type-title-weight)",
          fontSize: "var(--type-title-size)", lineHeight: "var(--type-title-lh)", letterSpacing: "var(--type-title-ls)",
          color: inverse ? "var(--text-inverse)" : "var(--brand-accent)",
        }}>{title}</h2>
      ) : null}
      {description ? (
        <p style={{ margin: "12px 0 0", maxWidth: "var(--measure)", fontSize: "var(--type-body-size)", lineHeight: "var(--type-body-lh)", color: metaColor }}>{description}</p>
      ) : null}
    </header>
  );
}

import React from "react";

/** Section label: 11px uppercase Figtree, semibold, modest tracking — the
 *  brochure's "ABOUT US" voice. Optionally trailed by a hairline rule. */
export function MonoLabel({ children, tone = "muted", rule, count, size = "sm", style, ...rest }) {
  const colors = { muted: "var(--text-muted)", faint: "var(--text-faint)", brand: "var(--green-700)", body: "var(--text-body)", inverse: "rgba(255,255,255,.72)" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, ...style }} {...rest}>
      <span style={{
        fontFamily: "var(--font-label)", textTransform: "uppercase",
        fontSize: "var(--type-meta-size)",
        letterSpacing: size === "lg" ? "var(--type-meta-wide-ls)" : "var(--type-meta-ls)",
        lineHeight: "var(--type-meta-lh)", fontWeight: "var(--type-meta-weight)", color: colors[tone], whiteSpace: "nowrap",
      }}>{children}</span>
      {count != null ? <span style={{ fontFamily: "var(--font-figure)", fontSize: 14, fontWeight: 500, letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums", color: "var(--text-quiet)" }}>{count}</span> : null}
      {rule ? <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} /> : null}
    </div>
  );
}

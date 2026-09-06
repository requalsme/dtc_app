import React from "react";

const ROLES = {
  display: { fontFamily: "var(--font-display)", fontSize: "var(--type-display-size)", lineHeight: "var(--type-display-lh)", letterSpacing: "var(--type-display-ls)", fontWeight: 400 },
  title: { fontFamily: "var(--font-display)", fontSize: "var(--type-title-size)", lineHeight: "var(--type-title-lh)", letterSpacing: "var(--type-title-ls)", fontWeight: 400 },
  section: { fontFamily: "var(--font-ui)", fontSize: "var(--type-section-size)", lineHeight: "var(--type-section-lh)", letterSpacing: "var(--type-section-ls)", fontWeight: 600 },
  card: { fontFamily: "var(--font-ui)", fontSize: "var(--type-card-size)", lineHeight: "var(--type-card-lh)", letterSpacing: "var(--type-card-ls)", fontWeight: 600 },
  body: { fontFamily: "var(--font-ui)", fontSize: "var(--type-body-size)", lineHeight: "var(--type-body-lh)", fontWeight: 400 },
  support: { fontFamily: "var(--font-ui)", fontSize: "var(--type-support-size)", lineHeight: "var(--type-support-lh)", fontWeight: 400 },
  meta: { fontFamily: "var(--font-mono)", fontSize: "var(--type-meta-size)", lineHeight: "var(--type-meta-lh)", letterSpacing: "var(--type-meta-ls)", textTransform: "uppercase", fontWeight: 500 },
  figure: { fontFamily: "var(--font-figure)", fontSize: "var(--type-figure-size)", lineHeight: "var(--type-figure-lh)", letterSpacing: "var(--type-figure-ls)", fontWeight: "var(--type-figure-weight)", fontVariantNumeric: "tabular-nums" },
  numeral: { fontFamily: "var(--font-figure)", fontSize: "var(--type-figure-inline-size)", letterSpacing: "var(--type-figure-inline-ls)", fontWeight: 500, fontVariantNumeric: "tabular-nums" },
};

const COLORS = {
  primary: "var(--text-primary)", secondary: "var(--text-secondary)", quiet: "var(--text-quiet)",
  brand: "var(--brand-accent)", inverse: "var(--text-inverse)",
  success: "var(--status-success)", warning: "var(--status-warning)", danger: "var(--status-danger)",
};

/** Typed text. Every string in the product should name its ladder step. */
export function Text({ as = "span", role = "body", color = "primary", measure, tabular, children, style, ...rest }) {
  return React.createElement(as, {
    style: {
      margin: 0, ...ROLES[role], color: COLORS[color],
      maxWidth: measure ? "var(--measure)" : undefined,
      fontVariantNumeric: tabular ? "tabular-nums" : undefined,
      ...style,
    }, ...rest,
  }, children);
}

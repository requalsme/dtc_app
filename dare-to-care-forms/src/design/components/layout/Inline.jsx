import React from "react";

/** Horizontal grouping primitive. */
export function Inline({ gap = 3, align = "center", justify, wrap, children, style, ...rest }) {
  const g = typeof gap === "number" && gap <= 24 ? `var(--space-${gap})` : gap;
  return (
    <div style={{ display: "flex", alignItems: align, justifyContent: justify, gap: g, flexWrap: wrap ? "wrap" : "nowrap", minWidth: 0, ...style }} {...rest}>
      {children}
    </div>
  );
}

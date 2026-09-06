import React from "react";

/** Vertical rhythm primitive. gap accepts a space-token step (1-24) or px. */
export function Stack({ gap = 4, align, divide, children, style, ...rest }) {
  const g = typeof gap === "number" && gap <= 24 ? `var(--space-${gap})` : gap;
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: divide ? 0 : g, alignItems: align, minWidth: 0, ...style }} {...rest}>
      {divide
        ? kids.map((c, i) => (
            <div key={i} style={{ borderTop: i ? "1px solid var(--border-hair)" : "none", paddingTop: i ? g : 0, paddingBottom: i < kids.length - 1 ? g : 0 }}>{c}</div>
          ))
        : kids}
    </div>
  );
}

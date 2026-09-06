import React from "react";

/** A background change with optional hairline — used instead of enclosing
 *  content in a card. Bands run full-bleed; panels are inset. */
export function Surface({ tone = "base", border, radius = "panel", bleed, grid, dots, padding, children, style, ...rest }) {
  const tones = {
    base: { background: "var(--surface-base)", color: "var(--text-primary)" },
    raised: { background: "var(--surface-raised)", color: "var(--text-primary)" },
    sunken: { background: "var(--surface-sunken)", color: "var(--text-primary)" },
    accent: { background: "var(--surface-accent)", color: "var(--brand-accent)" },
    inverse: { background: "var(--surface-inverse-base)", color: "var(--text-inverse)" },
    none: { background: "transparent" },
  };
  const texture = grid
    ? { backgroundImage: "linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)", backgroundSize: "var(--grid-size) var(--grid-size)" }
    : dots
    ? { backgroundImage: "radial-gradient(var(--grid-line) 1.4px, transparent 1.4px)", backgroundSize: "var(--grid-size) var(--grid-size)" }
    : null;
  return (
    <div style={{
      ...tones[tone], ...texture,
      border: border ? "1px solid var(--border-subtle)" : undefined,
      borderRadius: bleed ? 0 : `var(--radius-${radius})`,
      padding, position: "relative", ...style,
    }} {...rest}>{children}</div>
  );
}

import React from "react";

/* The hairline — structure in this system is drawn with rules, not shadows.
   This is the ONE divider primitive. (An earlier `Divider` in components/layout
   duplicated it with a divergent prop set; it was removed rather than kept in
   sync, because two near-identical primitives is how the wrong prop gets passed.) */
export function Rule({ vertical, strength = "subtle", accent, length, inset = 0, mark, style, ...rest }) {
  const colors = {
    hair: "var(--border-hair)",
    subtle: "var(--border-subtle)",
    default: "var(--border-default)",
    strong: "var(--border-default)",
    brand: "var(--green-300)",
  };
  const color = accent ? "var(--brand-primary)" : colors[strength] || colors.subtle;

  /* `mark` places a small hairline diamond at the midpoint — the ruled-catalog
     intersection detail. A section break, so use it once or twice per screen. */
  if (mark && !vertical) {
    return (
      <div role="separator" style={{ display: "flex", alignItems: "center", gap: 9, width: length || "100%", ...style }} {...rest}>
        <span style={{ flex: 1, height: 1, background: color }} />
        <span style={{ width: 5, height: 5, border: `1px solid ${color}`, transform: "rotate(45deg)", flex: "0 0 auto" }} />
        <span style={{ flex: 1, height: 1, background: color }} />
      </div>
    );
  }

  return (
    <div role="separator" style={{
      background: color, flex: "0 0 auto",
      width: vertical ? (accent ? "var(--rule-strong)" : 1) : (length || "100%"),
      height: vertical ? (length || "100%") : (accent ? "var(--rule-strong)" : 1),
      marginTop: vertical ? 0 : inset, marginBottom: vertical ? 0 : inset,
      ...style,
    }} {...rest} />
  );
}

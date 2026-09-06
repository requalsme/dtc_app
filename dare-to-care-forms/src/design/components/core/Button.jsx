import React from "react";

const SIZES = {
  sm: { height: "var(--control-height-sm)", padding: "0 14px", font: 13.5, gap: 6, radius: "var(--radius-cta)" },
  md: { height: "var(--control-height-md)", padding: "0 20px", font: 14.5, gap: 8, radius: "var(--radius-cta)" },
  lg: { height: "var(--control-height-lg)", padding: "0 28px", font: 16, gap: 9, radius: "var(--radius-cta-lg)" },
};

/* Material, not chrome. A filled control is a flat solid — no gradient, no inner
   highlight, no bevel. What makes it feel physical is the pair of tinted
   shadows (tight contact + soft ambient), the generous continuous radius, and
   the fact that it compresses toward its own centre when pressed. */
const VARIANTS = {
  primary: {
    rest: { background: "var(--action-primary-bg)", color: "var(--action-primary-fg)", boxShadow: "var(--shadow-control)" },
    hover: { background: "var(--green-600)", boxShadow: "var(--shadow-control-hover)" },
  },
  secondary: {
    rest: { background: "var(--surface-accent)", color: "var(--action-secondary-fg)", boxShadow: "var(--shadow-control-quiet)" },
    hover: { background: "var(--surface-accent-strong)", boxShadow: "var(--shadow-control)" },
  },
  outline: {
    rest: { background: "var(--surface-raised)", color: "var(--text-body)", boxShadow: "inset 0 0 0 1px var(--border-default)" },
    hover: { color: "var(--brand-accent)", boxShadow: "inset 0 0 0 1px var(--brand-primary), var(--shadow-control-quiet)" },
  },
  ghost: {
    rest: { background: "transparent", color: "var(--action-ghost-fg)", boxShadow: "none" },
    hover: { background: "var(--green-050)" },
  },
  danger: {
    rest: { background: "var(--error-bg)", color: "var(--status-danger)", boxShadow: "var(--shadow-control-quiet)" },
    hover: { background: "#EEDADD", boxShadow: "var(--shadow-control)" },
  },
  solid_danger: {
    rest: { background: "var(--status-danger)", color: "#fff", boxShadow: "var(--shadow-control)" },
    hover: { background: "#7E3742", boxShadow: "var(--shadow-control-hover)" },
  },
};

export function Button({ variant = "primary", size = "md", iconLeft, iconRight, fullWidth, disabled, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const s = SIZES[size], v = VARIANTS[variant] || VARIANTS.primary;
  const pressScale = size === "lg" ? "var(--press-scale-lg)" : "var(--press-scale)";
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDown(false); }}
      onMouseDown={() => setDown(true)}
      onMouseUp={() => setDown(false)}
      onTouchStart={() => setDown(true)}
      onTouchEnd={() => setDown(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: s.gap,
        height: s.height, padding: s.padding, fontSize: s.font,
        fontFamily: "var(--font-ui)", fontWeight: 600, lineHeight: 1,
        letterSpacing: "-0.006em", whiteSpace: "nowrap",
        border: 0, borderRadius: s.radius,
        cursor: disabled ? "default" : "pointer",
        width: fullWidth ? "100%" : undefined,
        WebkitTapHighlightColor: "transparent",
        transformOrigin: "center",
        transition: [
          "background var(--duration-hover) var(--ease-standard)",
          "color var(--duration-hover) var(--ease-standard)",
          "box-shadow var(--duration-panel) var(--ease-standard)",
          "transform var(--duration-press) var(--ease-out)",
        ].join(", "),
        ...v.rest,
        ...(hover && !disabled ? v.hover : null),
        ...(down && !disabled ? { transform: `scale(${pressScale})`, boxShadow: "var(--shadow-control-quiet)" } : null),
        ...(disabled ? { background: "var(--surface-sunken)", color: "var(--text-disabled)", boxShadow: "none" } : null),
        ...style,
      }}
      {...rest}
    >
      {iconLeft}
      <span style={{ display: "inline-flex", alignItems: "center", minWidth: 0 }}>{children}</span>
      {iconRight}
    </button>
  );
}

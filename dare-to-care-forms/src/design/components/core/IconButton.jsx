import React from "react";

const SIZES = { sm: 32, md: 40, lg: 48 };

/* Same material rules as Button: flat fill, tinted shadow pair, generous radius,
   compression on press. Never a bevel or a gradient. */
export function IconButton({ icon, label, variant = "ghost", size = "md", disabled, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const px = SIZES[size];
  const skins = {
    ghost: {
      background: hover ? "var(--green-050)" : "transparent",
      color: hover ? "var(--brand-accent)" : "var(--text-secondary)",
      boxShadow: "none",
    },
    outline: {
      background: "var(--surface-raised)",
      color: hover ? "var(--brand-accent)" : "var(--text-body)",
      boxShadow: hover
        ? "inset 0 0 0 1px var(--brand-primary), var(--shadow-control-quiet)"
        : "inset 0 0 0 1px var(--border-default)",
    },
    subtle: {
      background: hover ? "var(--surface-accent-strong)" : "var(--surface-accent)",
      color: "var(--brand-accent)",
      boxShadow: hover ? "var(--shadow-control)" : "var(--shadow-control-quiet)",
    },
    solid: {
      background: hover ? "var(--green-600)" : "var(--action-primary-bg)",
      color: "#fff",
      boxShadow: hover ? "var(--shadow-control-hover)" : "var(--shadow-control)",
    },
  };
  return (
    <button aria-label={label} title={label} disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDown(false); }}
      onMouseDown={() => setDown(true)} onMouseUp={() => setDown(false)}
      onTouchStart={() => setDown(true)} onTouchEnd={() => setDown(false)}
      style={{
        width: px, height: px, display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: 0, borderRadius: "var(--radius-cta)",
        cursor: disabled ? "default" : "pointer",
        WebkitTapHighlightColor: "transparent",
        transition: [
          "background var(--duration-hover) var(--ease-standard)",
          "color var(--duration-hover) var(--ease-standard)",
          "box-shadow var(--duration-panel) var(--ease-standard)",
          "transform var(--duration-press) var(--ease-out)",
        ].join(", "),
        ...(skins[variant] || skins.ghost),
        ...(down && !disabled ? { transform: "scale(var(--press-scale))", boxShadow: "var(--shadow-control-quiet)" } : null),
        ...(disabled ? { background: "var(--surface-sunken)", color: "var(--text-disabled)", boxShadow: "none" } : null),
        ...style,
      }} {...rest}>
      {icon}
    </button>
  );
}

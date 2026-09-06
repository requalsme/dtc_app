import React from "react";

/** A selectable chip — filters, tags, form categories. Pill silhouette with a
 *  hairline ring; the selected state fills pale mint and tightens the ring
 *  rather than shouting in saturated green. */
export function Chip({ selected, onRemove, icon, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const clickable = !!rest.onClick;
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDown(false); }}
      onMouseDown={() => setDown(true)} onMouseUp={() => setDown(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        height: 30, padding: "0 12px",
        borderRadius: "var(--radius-chip)", cursor: clickable ? "pointer" : "default",
        WebkitTapHighlightColor: "transparent",
        fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 500, lineHeight: 1,
        letterSpacing: "-0.004em", whiteSpace: "nowrap",
        transition: "background var(--duration-hover) var(--ease-standard), box-shadow var(--duration-panel) var(--ease-standard), transform var(--duration-press) var(--ease-out)",
        background: selected ? "var(--surface-accent)" : hover && clickable ? "var(--green-050)" : "var(--surface-raised)",
        color: selected ? "var(--brand-accent)" : "var(--text-body)",
        border: 0,
        boxShadow: selected
          ? "inset 0 0 0 1px var(--brand-primary)"
          : `inset 0 0 0 1px var(--border-subtle)${hover && clickable ? ", var(--shadow-control-quiet)" : ""}`,
        transform: down && clickable ? "scale(var(--press-scale))" : "none",
        ...style,
      }} {...rest}>
      {icon}
      <span style={{ display: "inline-flex", alignItems: "center", minWidth: 0 }}>{children}</span>
      {onRemove ? (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Remove"
          style={{ border: 0, background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      ) : null}
    </span>
  );
}

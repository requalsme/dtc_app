import React from "react";

/** A submission / application / document row. Identity is the catalog index at the
 *  leading edge; status is a stamp at the trailing edge. */
export function RecordRow({ index, icon, title, subtitle, meta, stamp, actions, selected, accentEdge, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 16,
        padding: "14px 18px", overflow: "hidden",
        borderRadius: "var(--radius-panel)", cursor: onClick ? "pointer" : "default",
        background: selected ? "var(--state-selected-bg)" : "var(--surface-card)",
        border: `1px solid ${selected ? "var(--border-brand)" : hover && onClick ? "var(--green-500)" : "var(--border-subtle)"}`,
        transition: "border-color var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)",
        fontFamily: "var(--font-ui)", minHeight: 66, ...style,
      }} {...rest}>
      {accentEdge ? <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "var(--indicator)", background: "var(--green-700)" }} /> : null}
      {index != null ? (
        <span style={{ fontFamily: "var(--font-figure)", fontSize: 14, letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums", color: "var(--text-quiet)", width: 24, flex: "0 0 auto" }}>
          {String(index).padStart(2, "0")}
        </span>
      ) : null}
      {icon ? <span style={{ color: "var(--green-700)", display: "flex" }}>{icon}</span> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-body-size)", fontWeight: 600, letterSpacing: "-0.005em", color: "var(--text-body)" }}>{title}</div>
        {subtitle ? <div style={{ fontSize: "var(--text-sm-size)", color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div> : null}
      </div>
      {meta ? <div style={{ fontFamily: "var(--font-figure)", fontSize: "var(--type-figure-inline-size)", letterSpacing: "var(--type-figure-inline-ls)", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)", textAlign: "right", whiteSpace: "nowrap" }}>{meta}</div> : null}
      {stamp}
      {actions}
    </div>
  );
}

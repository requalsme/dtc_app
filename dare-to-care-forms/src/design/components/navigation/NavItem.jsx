import React from "react";

export function NavItem({ icon, label, active, badge, external, collapsed, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      aria-current={active ? "page" : undefined}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 11, width: "100%",
        minHeight: "var(--touch-min)", padding: collapsed ? 0 : "0 12px 0 14px",
        justifyContent: collapsed ? "center" : "flex-start",
        border: 0, cursor: "pointer", textAlign: "left",
        borderRadius: "var(--radius-control)",
        background: active ? "var(--state-selected-bg)" : hover ? "var(--green-050)" : "transparent",
        color: active ? "var(--state-selected-fg)" : "var(--text-muted)",
        fontFamily: "var(--font-ui)", fontSize: "var(--text-sm-size)",
        fontWeight: active ? "var(--weight-semibold)" : "var(--weight-medium)",
        transition: "background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)",
        ...style,
      }} {...rest}>
      {active ? <span style={{ position: "absolute", left: 0, top: 9, bottom: 9, width: "var(--indicator)", borderRadius: "0 2px 2px 0", background: "var(--green-700)" }} /> : null}
      {icon}
      {collapsed ? null : <span style={{ flex: 1 }}>{label}</span>}
      {!collapsed && external ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ color: "var(--text-faint)" }}><path d="M7 17L17 7M17 7H9M17 7v8" /></svg> : null}
      {!collapsed && badge ? (
        <span style={{
          minWidth: 20, height: 18, padding: "0 6px", borderRadius: "var(--radius-hair)",
          display: "grid", placeItems: "center", background: "var(--error-bg)", color: "var(--error-fg)",
          border: "1px solid rgba(169,80,63,.3)",
          fontFamily: "var(--font-figure)", fontSize: 12, fontWeight: 500, lineHeight: 1, fontVariantNumeric: "tabular-nums",
        }}>{badge}</span>
      ) : null}
    </button>
  );
}

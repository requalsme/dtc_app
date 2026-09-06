import React from "react";

/** A role choice on the login screen. Mirrors the application's RBAC set:
 *  administrator, office manager, caregiver, new hire, client. */
export function RoleTile({ role, title, summary, accent, hint, selected, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const color = `var(--role-${role})`;
  return (
    <button
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", flexDirection: "column", gap: 6, textAlign: "left", width: "100%",
        padding: "16px 18px", cursor: "pointer",
        borderRadius: "var(--radius-panel)",
        background: selected ? "var(--surface-accent)" : "var(--surface-card)",
        border: `1px solid ${selected || hover ? color : "var(--border-subtle)"}`,
        borderLeft: `var(--indicator) solid ${color}`,
        transition: "border-color var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)",
        ...style,
      }} {...rest}>
      <span style={{ fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: "var(--text-mono-size)", letterSpacing: "var(--text-mono-ls)", color }}>{title}</span>
      {summary ? <span style={{ fontFamily: "var(--font-ui)", fontSize: "var(--text-sm-size)", color: "var(--text-body)", lineHeight: 1.5 }}>{summary}</span> : null}
      {hint ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "var(--text-faint)" }}>{hint}</span> : null}
    </button>
  );
}

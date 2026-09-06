import React from "react";

export function Textarea({ label, hint, error, rows = 4, id, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const uid = id || React.useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-ui)" }}>
      {label ? <label htmlFor={uid} style={{ fontSize: "var(--type-support-size)", fontWeight: 600, letterSpacing: "0.005em" }}>{label}</label> : null}
      <textarea id={uid} rows={rows}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          resize: "vertical", padding: "12px 14px", borderRadius: "var(--radius-control)",
          border: `1px solid ${error ? "var(--error-fg)" : focus ? "var(--border-strong)" : "var(--border-default)"}`,
          boxShadow: focus ? "var(--shadow-focus)" : "none", outline: "none",
          background: "var(--surface-card)", color: "var(--text-body)",
          fontFamily: "var(--font-ui)", fontSize: "var(--text-body-size)", lineHeight: "var(--text-body-lh)",
          transition: "border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
          ...style,
        }} {...rest} />
      {error ? <span style={{ fontSize: "var(--text-xs-size)", color: "var(--error-fg)" }}>{error}</span>
        : hint ? <span style={{ fontSize: "var(--text-xs-size)", color: "var(--text-muted)" }}>{hint}</span> : null}
    </div>
  );
}

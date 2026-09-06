import React from "react";

export function Select({ label, hint, error, options = [], id, style, children, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const uid = id || React.useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-ui)" }}>
      {label ? <label htmlFor={uid} style={{ fontSize: "var(--type-support-size)", fontWeight: 600, letterSpacing: "0.005em" }}>{label}</label> : null}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select id={uid}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            appearance: "none", width: "100%", height: "var(--control-height-md)",
            padding: "0 40px 0 14px", borderRadius: "var(--radius-control)",
            border: `1px solid ${error ? "var(--error-fg)" : focus ? "var(--border-strong)" : "var(--border-default)"}`,
            boxShadow: focus ? "var(--shadow-focus)" : "none", outline: "none",
            background: "var(--surface-card)", color: "var(--text-body)",
            fontFamily: "var(--font-ui)", fontSize: "var(--text-body-size)", cursor: "pointer",
            ...style,
          }} {...rest}>
          {options.map((o) => typeof o === "string"
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>)}
          {children}
        </select>
        <span aria-hidden="true" style={{ position: "absolute", right: 14, color: "var(--text-muted)", pointerEvents: "none", fontSize: 12 }}>▾</span>
      </div>
      {error ? <span style={{ fontSize: "var(--text-xs-size)", color: "var(--error-fg)" }}>{error}</span>
        : hint ? <span style={{ fontSize: "var(--text-xs-size)", color: "var(--text-muted)" }}>{hint}</span> : null}
    </div>
  );
}

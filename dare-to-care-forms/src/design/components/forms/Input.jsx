import React from "react";

export function Input({ label, hint, error, iconLeft, iconRight, id, disabled, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const uid = id || React.useId();
  const borderColor = error ? "var(--error-fg)" : focus ? "var(--border-strong)" : "var(--border-default)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-ui)" }}>
      {label ? <label htmlFor={uid} style={{ fontSize: "var(--type-support-size)", fontWeight: 600, letterSpacing: "0.005em", color: "var(--text-body)" }}>{label}</label> : null}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, height: "var(--control-height-md)",
        padding: "0 14px", borderRadius: "var(--radius-control)",
        background: disabled ? "var(--gray-100)" : "var(--surface-card)",
        border: `1px solid ${borderColor}`,
        boxShadow: focus ? "var(--shadow-focus)" : "none",
        transition: "border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
        color: "var(--text-muted)", ...style,
      }}>
        {iconLeft}
        <input id={uid} disabled={disabled}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, border: 0, outline: "none", background: "transparent", minWidth: 0,
            fontFamily: "var(--font-ui)", fontSize: "var(--text-body-size)",
            color: disabled ? "var(--text-disabled)" : "var(--text-body)" }}
          {...rest} />
        {iconRight}
      </div>
      {error ? <span style={{ fontSize: "var(--text-xs-size)", color: "var(--error-fg)" }}>{error}</span>
        : hint ? <span style={{ fontSize: "var(--text-xs-size)", color: "var(--text-muted)" }}>{hint}</span> : null}
    </div>
  );
}

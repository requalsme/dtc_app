import React from "react";

export function Radio({ label, description, checked, onChange, name, value, disabled, style, ...rest }) {
  return (
    <label style={{
      display: "flex", gap: 12, alignItems: description ? "flex-start" : "center",
      cursor: disabled ? "default" : "pointer", fontFamily: "var(--font-ui)",
      minHeight: "var(--touch-min)", ...style,
    }}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} {...rest} />
      <span aria-hidden="true" style={{
        width: 20, height: 20, flex: "0 0 auto", marginTop: description ? 3 : 0, borderRadius: 999,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "var(--surface-card)",
        border: `1px solid ${checked ? "var(--green-700)" : "var(--border-default)"}`,
        transition: "border-color var(--duration-fast) var(--ease-standard)",
      }}>
        {checked ? <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--green-700)" }} /> : null}
      </span>
      <span>
        <span style={{ fontSize: "var(--text-body-size)", color: disabled ? "var(--text-disabled)" : "var(--text-body)" }}>{label}</span>
        {description ? <span style={{ display: "block", fontSize: "var(--text-sm-size)", color: "var(--text-muted)" }}>{description}</span> : null}
      </span>
    </label>
  );
}

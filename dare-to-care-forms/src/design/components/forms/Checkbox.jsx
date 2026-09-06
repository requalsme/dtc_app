import React from "react";

export function Checkbox({ label, description, checked, onChange, disabled, size = "md", style, ...rest }) {
  const px = size === "lg" ? 26 : 20;
  return (
    <label style={{
      display: "flex", gap: 12, alignItems: description ? "flex-start" : "center",
      cursor: disabled ? "default" : "pointer", fontFamily: "var(--font-ui)",
      minHeight: "var(--touch-min)", ...style,
    }}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} {...rest} />
      <span aria-hidden="true" style={{
        width: px, height: px, flex: "0 0 auto", marginTop: description ? 2 : 0,
        borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: disabled ? "var(--gray-100)" : checked ? "var(--green-700)" : "var(--surface-card)",
        border: `1px solid ${checked ? "var(--green-700)" : "var(--border-default)"}`,
        color: "#fff", fontSize: px * 0.62, lineHeight: 1,
        transition: "background var(--duration-fast) var(--ease-standard)",
      }}>{checked ? "✓" : ""}</span>
      <span>
        <span style={{ fontSize: "var(--text-body-size)", color: disabled ? "var(--text-disabled)" : "var(--text-body)" }}>{label}</span>
        {description ? <span style={{ display: "block", fontSize: "var(--text-sm-size)", color: "var(--text-muted)" }}>{description}</span> : null}
      </span>
    </label>
  );
}

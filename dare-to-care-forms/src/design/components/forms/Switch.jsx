import React from "react";

export function Switch({ label, description, checked, onChange, disabled, style, ...rest }) {
  return (
    <label style={{
      display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between",
      cursor: disabled ? "default" : "pointer", fontFamily: "var(--font-ui)",
      minHeight: "var(--touch-min)", ...style,
    }}>
      <span>
        <span style={{ fontSize: "var(--text-body-size)", color: disabled ? "var(--text-disabled)" : "var(--text-body)" }}>{label}</span>
        {description ? <span style={{ display: "block", fontSize: "var(--text-sm-size)", color: "var(--text-muted)" }}>{description}</span> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} disabled={disabled}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} {...rest} />
      <span aria-hidden="true" style={{
        width: 48, height: 28, flex: "0 0 auto", borderRadius: 999, padding: 3,
        background: disabled ? "var(--gray-200)" : checked ? "var(--green-700)" : "var(--gray-300)",
        transition: "background var(--duration-base) var(--ease-standard)",
        display: "flex", alignItems: "center",
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 999, background: "#fff",
          boxShadow: "var(--shadow-xs)",
          transform: checked ? "translateX(20px)" : "translateX(0)",
          transition: "transform var(--duration-base) var(--ease-standard)",
        }} />
      </span>
    </label>
  );
}

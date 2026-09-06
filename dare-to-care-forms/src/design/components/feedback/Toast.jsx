import React from "react";

/** The application's transient confirmation, pinned bottom-centre. */
export function Toast({ children, tone = "default", icon, style, ...rest }) {
  const skins = {
    default: { background: "#16352A", color: "var(--text-on-inverse)" },
    success: { background: "var(--green-900)", color: "#fff" },
    error: { background: "#6E3227", color: "#fff" },
  };
  return (
    <div role="status" style={{
      position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)",
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "12px 18px", borderRadius: "var(--radius-control)",
      boxShadow: "var(--shadow-paper)", zIndex: 999,
      fontFamily: "var(--font-ui)", fontSize: "var(--text-sm-size)", fontWeight: 500,
      ...skins[tone], ...style,
    }} {...rest}>
      {icon}
      {children}
    </div>
  );
}

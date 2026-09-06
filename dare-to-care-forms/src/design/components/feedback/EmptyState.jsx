import React from "react";

export function EmptyState({ title, description, action, basePath = "", watermark = true, style, ...rest }) {
  const prefix = basePath ? basePath.replace(/\/$/, "") + "/" : "";
  return (
    <div style={{
      position: "relative", overflow: "hidden", textAlign: "center",
      background: "var(--surface-paper)", border: "1px solid var(--border-paper)",
      borderRadius: "var(--radius-panel)", padding: "40px 28px",
      fontFamily: "var(--font-ui)", ...style,
    }} {...rest}>
      {watermark ? <img src={prefix + "assets/mark-leaf.png"} alt="" aria-hidden="true"
        style={{ position: "absolute", right: -24, bottom: -34, height: 150, opacity: 0.07, pointerEvents: "none" }} /> : null}
      <div style={{ position: "relative" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, letterSpacing: "-0.02em", color: "var(--text-brand)" }}>{title}</div>
        {description ? <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: "var(--text-body-size)" }}>{description}</div> : null}
        {action ? <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>{action}</div> : null}
      </div>
    </div>
  );
}

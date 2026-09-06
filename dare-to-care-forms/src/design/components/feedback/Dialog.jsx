import React from "react";

export function Dialog({ open, title, description, icon, footer, onClose, width = 460, children, style, ...rest }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50, background: "var(--overlay-scrim)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      animation: "none", fontFamily: "var(--font-ui)",
    }}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: width, background: "var(--surface-card)",
          borderRadius: "var(--radius-panel)", boxShadow: "var(--shadow-paper)",
          border: "1px solid var(--border-subtle)", padding: 24, ...style,
        }} {...rest}>
        {icon ? <div style={{
          width: 44, height: 44, borderRadius: "var(--radius-panel)", background: "var(--green-100)",
          color: "var(--green-700)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
        }}>{icon}</div> : null}
        {title ? <h2 style={{ margin: 0, fontSize: "var(--text-h2-size)", lineHeight: "var(--text-h2-lh)", color: "var(--text-body)" }}>{title}</h2> : null}
        {description ? <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: "var(--text-body-size)", lineHeight: "var(--text-body-lh)" }}>{description}</p> : null}
        {children ? <div style={{ marginTop: 18 }}>{children}</div> : null}
        {footer ? <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>{footer}</div> : null}
      </div>
    </div>
  );
}

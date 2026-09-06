import React from "react";

const TONES = {
  info: { bg: "var(--info-bg)", fg: "var(--info-fg)" },
  success: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  error: { bg: "var(--error-bg)", fg: "var(--error-fg)" },
};

export function Banner({ tone = "info", icon, title, name, action, onDismiss, children, style, ...rest }) {
  const t = TONES[tone];
  return (
    <div role="status" style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      background: t.bg, border: `1px solid ${t.fg}33`,
      borderRadius: "var(--radius-panel)", padding: "14px 16px",
      fontFamily: "var(--font-ui)", color: "var(--text-body)", ...style,
    }} {...rest}>
      {icon ? <span style={{ color: t.fg, marginTop: 1 }}>{icon}</span> : null}
      <div style={{ flex: 1 }}>
        {title ? <div style={{ fontWeight: "var(--weight-semibold)", color: t.fg, fontSize: "var(--text-body-size)" }}>{title}</div> : null}
        {children ? (
          <div style={{ fontSize: "var(--text-sm-size)", color: "var(--text-body)", marginTop: title ? 2 : 0 }}>
            {name ? <span style={{ fontWeight: "var(--weight-bold)", color: "var(--brand-accent)" }}>{name}{" "}</span> : null}
            {children}
          </div>
        ) : null}
      </div>
      {action}
      {onDismiss ? <button onClick={onDismiss} aria-label="Dismiss" style={{ border: 0, background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button> : null}
    </div>
  );
}

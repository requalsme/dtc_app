import React from "react";

const TONES = {
  default: { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", color: "var(--text-body)" },
  rail: { background: "var(--surface-rail)", border: "1px solid var(--border-hair)", color: "var(--text-body)" },
  sunken: { background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)", color: "var(--text-body)" },
  accent: { background: "var(--surface-accent)", border: "1px solid var(--border-brand)", color: "var(--green-900)" },
  inverse: { background: "var(--surface-inverse)", border: "1px solid var(--green-900)", color: "#fff" },
  paper: { background: "var(--surface-raised)", border: "1px solid var(--border-subtle)", color: "var(--text-body)" },
};

/* The filed corner: a 15px chamfer on the top-right, the way a document corner
   is clipped when it goes into a file. It is the system's one non-rectangular
   move — used on records and summary panels, never on every panel at once. */
const NOTCH = "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)";

/** A hairline-bordered field. The system's only container: 8px corners, no shadow at
 *  rest, optional sage hairline grid, optional mono eyebrow in a ruled header rail. */
export function Panel({ tone = "default", padding = 20, label, labelRight, footer, grid, accentEdge, notch, interactive, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const t = TONES[tone];
  return (
    <div
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        borderRadius: "var(--radius-panel)", position: "relative", overflow: "hidden",
        cursor: interactive ? "pointer" : undefined,
        clipPath: notch ? NOTCH : undefined,
        transition: "border-color var(--duration-panel) var(--ease-standard), box-shadow var(--duration-panel) var(--ease-standard)",
        backgroundImage: grid ? `linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)` : undefined,
        backgroundSize: grid ? "var(--grid-size) var(--grid-size)" : undefined,
        ...t,
        ...(hover ? { borderColor: "var(--border-strong)", boxShadow: "var(--shadow-raised)" } : null),
        ...style,
      }}
      {...rest}
    >
      {accentEdge ? <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "var(--indicator)", background: "var(--brand-primary)" }} /> : null}
      {notch ? <span aria-hidden="true" style={{ position: "absolute", right: -1, top: -1, width: 19, height: 19, borderLeft: "1px solid var(--border-subtle)", transform: "rotate(45deg)", transformOrigin: "top left", pointerEvents: "none" }} /> : null}
      {label ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border-hair)" }}>
          <span style={{ fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: "var(--text-mono-size)", letterSpacing: "var(--text-mono-ls)", color: tone === "inverse" ? "rgba(255,255,255,.7)" : "var(--text-muted)" }}>{label}</span>
          <span style={{ flex: 1 }} />
          {labelRight}
        </div>
      ) : null}
      <div style={{ padding }}>{children}</div>
      {footer ? <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-hair)", background: tone === "default" ? "var(--surface-rail)" : "transparent" }}>{footer}</div> : null}
    </div>
  );
}

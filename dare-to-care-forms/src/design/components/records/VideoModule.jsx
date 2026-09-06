import React from "react";

/** A training module row for the new-hire portal: progress, duration, state. */
export function VideoModule({ index, title, duration, progress = 0, locked, complete, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={locked ? undefined : onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 16, padding: "14px 18px",
        borderRadius: "var(--radius-panel)", cursor: locked ? "default" : "pointer",
        background: "var(--surface-card)",
        border: `1px solid ${hover && !locked ? "var(--green-500)" : "var(--border-subtle)"}`,
        opacity: locked ? 0.62 : 1,
        transition: "border-color var(--duration-fast) var(--ease-standard)",
        fontFamily: "var(--font-ui)", ...style,
      }} {...rest}>
      <span style={{
        width: 44, height: 34, flex: "0 0 auto", display: "grid", placeItems: "center",
        borderRadius: "var(--radius-hair)",
        background: complete ? "var(--green-700)" : "var(--surface-accent)",
        color: complete ? "#fff" : "var(--green-700)",
        border: "1px solid " + (complete ? "var(--green-700)" : "var(--border-brand)"),
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {locked ? <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>
            : complete ? <path d="M20 6L9 17l-5-5" />
            : <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></>}
        </svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {index != null ? <span style={{ fontFamily: "var(--font-figure)", fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "var(--text-quiet)" }}>{String(index).padStart(2, "0")}</span> : null}
          <span style={{ fontSize: "var(--text-body-size)", fontWeight: 600 }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <span style={{ flex: 1, height: 4, borderRadius: "var(--radius-pill)", background: "var(--gray-100)", overflow: "hidden" }}>
            <span style={{ display: "block", width: `${complete ? 100 : progress}%`, height: "100%", background: "var(--green-700)", borderRadius: "var(--radius-pill)" }} />
          </span>
          <span style={{ fontFamily: "var(--font-figure)", fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{duration}</span>
        </div>
      </div>
    </div>
  );
}

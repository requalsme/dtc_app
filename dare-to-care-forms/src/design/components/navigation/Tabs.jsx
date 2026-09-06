import React from "react";

export function Tabs({ tabs = [], value, onChange, style, ...rest }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-ui)", ...style }} {...rest}>
      {tabs.map((t) => {
        const key = t.value ?? t;
        const active = key === value;
        return (
          <button key={key} role="tab" aria-selected={active} onClick={() => onChange && onChange(key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "0 14px", height: 42,
              border: 0, background: "transparent", cursor: "pointer",
              fontFamily: "var(--font-ui)", fontSize: "var(--type-support-size)",
              letterSpacing: "0.005em",
              fontWeight: active ? 600 : 500, color: active ? "var(--green-900)" : "var(--text-secondary)",
              boxShadow: active ? "inset 0 -2px 0 var(--green-700)" : "none",
              transition: "color var(--duration-fast) var(--ease-standard)",
            }}>
            {t.icon}
            {t.label ?? t}
            {t.count != null ? <span style={{ fontFamily: "var(--font-figure)", fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "var(--text-quiet)" }}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

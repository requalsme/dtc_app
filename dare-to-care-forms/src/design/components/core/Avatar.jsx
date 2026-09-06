import React from "react";

const SIZES = { sm: 28, md: 34, lg: 48, xl: 64 };

/** Client and caregiver portrait. Always round, with a hairline ring set off the
 *  edge — the gap is what stops it reading as a flat coloured circle. Initials
 *  are set in the display serif, not the UI sans: a person's initials are a
 *  name, not data. Falls back to the leaf mark when there is no name. */
export function Avatar({ name = "", src, size = "md", role, markFallback, basePath = "", style, ...rest }) {
  const px = typeof size === "number" ? size : SIZES[size];
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const prefix = basePath ? basePath.replace(/\/$/, "") + "/" : "";
  const roleColor = role ? `var(--role-${role})` : null;
  return (
    <span title={name} style={{
      width: px, height: px, borderRadius: "var(--radius-pill)", flex: "0 0 auto",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      position: "relative",
      background: src ? "var(--surface-sunken)" : "linear-gradient(160deg, var(--green-050) 0%, var(--green-100) 100%)",
      color: roleColor || "var(--brand-accent)",
      boxShadow: `inset 0 0 0 1px ${roleColor ? roleColor + "2E" : "rgba(20,59,42,.12)"}, 0 0 0 1px var(--surface-base), 0 0 0 2px ${roleColor ? roleColor + "1F" : "var(--border-brand)"}`,
      fontFamily: "var(--font-display)", fontWeight: 500,
      fontSize: Math.max(11, Math.round(px * 0.4)),
      letterSpacing: "0.005em", lineHeight: 1, overflow: "hidden",
      ...style,
    }} {...rest}>
      {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
        : markFallback ? <img src={prefix + "assets/mark-leaf.png"} alt="" style={{ width: px * 0.6, opacity: .82 }} />
        : <span style={{ transform: "translateY(-0.02em)" }}>{initials}</span>}
    </span>
  );
}

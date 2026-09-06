import React from "react";

const SRC = {
  "lockup-green": "assets/logo-lockup.png",
  "lockup-white": "assets/logo-lockup-white.png",
  "mark-green": "assets/mark-leaf.png",
  "mark-white": "assets/mark-leaf-white.png",
};

/* Two traps this component exists to close.

   1. The lockup asset is 1014×504 — almost exactly 2:1. A "reasonable looking"
      height like 38px renders it ~76px wide, far under the 180px minimum in the
      brand rules, and the HOME CARE line turns to mush. So the lockup is sized
      by WIDTH, never height, and clamped to that minimum.

   2. `width: auto` on a block-level img inside a column flex parent gets
      stretched by the default `align-items: stretch` — the artwork smears
      sideways while its height stays pinned. Every branch therefore pins
      alignSelf, flexShrink and objectFit so no parent can distort the mark. */
const LOCKUP_RATIO = 1014 / 504;
const LOCKUP_MIN_WIDTH = 180;
const MARK_MIN_SIZE = 24;

// Never let a bad variant emit `prefix + undefined` and 404.
function resolve(variant, onDark) {
  const tone = onDark ? "white" : "green";
  return SRC[`${variant}-${tone}`] || SRC[`lockup-${tone}`];
}

const SAFE = { alignSelf: "flex-start", flexShrink: 0, objectFit: "contain", display: "block" };

export function Logo({ variant = "lockup", onDark = false, width, height, basePath = "", style, ...rest }) {
  const prefix = basePath ? basePath.replace(/\/$/, "") + "/" : "";
  const alt = "Dare to Care Home Care";

  /* "bar" is the sanctioned answer for chrome too short for the lockup (top
     bars, mastheads): the mark at full strength beside a typeset wordmark, so
     the brand still reads without crushing the artwork. */
  if (variant === "bar") {
    const size = Math.max(MARK_MIN_SIZE, height ?? 32);
    return (
      <span role="img" aria-label={alt}
        style={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-start", flexShrink: 0, gap: Math.round(size * 0.34), ...style }} {...rest}>
        <img src={prefix + resolve("mark", onDark)} alt="" aria-hidden="true"
          style={{ ...SAFE, height: size, width: size }} />
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 500,
            fontSize: Math.round(size * 0.56), letterSpacing: "-0.018em", whiteSpace: "nowrap",
            color: onDark ? "var(--text-inverse)" : "var(--brand-accent)",
          }}>Dare to Care</span>
          <span style={{
            marginTop: Math.max(2, Math.round(size * 0.09)),
            fontFamily: "var(--font-label)", textTransform: "uppercase", fontWeight: 600,
            fontSize: Math.max(8, Math.round(size * 0.28)), letterSpacing: "0.2em", whiteSpace: "nowrap",
            color: onDark ? "rgba(241,246,241,.6)" : "var(--text-quiet)",
          }}>Home care</span>
        </span>
      </span>
    );
  }

  if (variant === "mark") {
    const size = Math.max(MARK_MIN_SIZE, height ?? width ?? 28);
    return <img src={prefix + resolve("mark", onDark)} alt={alt}
      style={{ ...SAFE, height: size, width: size, ...style }} {...rest} />;
  }

  // Accept a width directly, or derive one from a height, then clamp.
  const requested = width ?? (height != null ? height * LOCKUP_RATIO : 216);
  const w = Math.max(LOCKUP_MIN_WIDTH, requested);

  if (requested < LOCKUP_MIN_WIDTH && typeof console !== "undefined") {
    console.warn(
      `[Logo] lockup requested at ${Math.round(requested)}px wide; clamped to ${LOCKUP_MIN_WIDTH}px. ` +
      `Use <Logo variant="bar" /> in short chrome, or variant="mark" for avatars and watermarks, ` +
      `instead of shrinking the lockup.`
    );
  }

  // Both dimensions are explicit: the true ratio is preserved no matter what the
  // parent's align-items does.
  return <img src={prefix + resolve("lockup", onDark)} alt={alt}
    style={{ ...SAFE, width: w, height: w / LOCKUP_RATIO, ...style }} {...rest} />;
}

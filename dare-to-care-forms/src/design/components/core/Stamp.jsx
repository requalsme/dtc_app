import React from "react";

/* Tag anatomy: a leaf cell, a hairline, then the status word — the silhouette
   stays rectangular.

   The leaf never deteriorates. It is the brand mark, so it keeps one upright
   silhouette in every state and carries meaning through a *fill level* instead:
   an outline leaf is unstarted, a half-filled leaf is in progress, a solid leaf
   with its vein fan is settled. Colour carries whether that state is good.
   Two readable dimensions, one constant glyph. */

const LEAF = "M16.7 2.6c-6.5.5-11.4 4.5-12.9 10.1-.3 1.1-.4 2.3-.4 3.4l-1.5 1.5a.7.7 0 1 0 1 1l1.5-1.5c5.9.2 10.6-3.7 11.8-9.8.3-1.5.5-3.1.5-4.7z";
const VEINS = [
  "M15.3 4.4C11.2 6.2 7.2 10 4.6 15.9",
  "M13.6 5.2c-.9 1.3-1 2.9-.5 4.4",
  "M10.4 8.2c-1 1.1-1.3 2.6-1 4.1",
  "M7.6 11.7c-.8 1-1 2.3-.8 3.5",
];

/* The leaf's mass runs diagonally from stem (2,18) to tip (17,3), so a partial
   fill is a hard-stop gradient along THAT axis — an axis-aligned band would
   only cover the stem corner. */
const STEM = { x: 2, y: 18 };
const TIP = { x: 17, y: 3 };

/** fill: 0 = outline, .5 = half, 1 = solid. */
function Leaf({ fill = 1, size = 14, id }) {
  const gradId = "lf" + id;
  const partial = fill > 0 && fill < 1;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ display: "block", flex: "0 0 auto" }}>
      {partial ? (
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse"
            x1={STEM.x} y1={STEM.y} x2={TIP.x} y2={TIP.y}>
            <stop offset={fill} stopColor="currentColor" />
            <stop offset={fill} stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
      ) : null}
      <path d={LEAF} fill={fill >= 1 ? "currentColor" : partial ? `url(#${gradId})` : "none"}
        stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
      {fill >= 1 ? VEINS.map((v, i) => (
        <path key={i} d={v} stroke="var(--stamp-vein, rgba(255,255,255,.82))" strokeWidth="1" strokeLinecap="round" />
      )) : null}
    </svg>
  );
}

const TONES = {
  neutral: { color: "var(--text-secondary)", border: "var(--border-default)", bg: "var(--surface-sunken)", fill: 0 },
  brand:   { color: "var(--green-900)",      border: "var(--border-brand)",   bg: "var(--green-100)",      fill: 1 },
  success: { color: "var(--status-success)", border: "rgba(30,104,72,.42)",    bg: "var(--success-bg)",     fill: 1 },
  info:    { color: "var(--status-info)",    border: "rgba(53,111,117,.42)",   bg: "var(--info-bg)",        fill: 0.5 },
  warning: { color: "var(--status-warning)", border: "rgba(115,88,111,.42)",   bg: "var(--warning-bg)",     fill: 0.5 },
  error:   { color: "var(--status-danger)",  border: "rgba(143,63,74,.42)",    bg: "var(--error-bg)",       fill: 0 },
};

/* Every stamp is the same size regardless of word length, so a column of them
   reads as one aligned rail rather than ragged pills. The leaf sits in its own
   fixed cell; the word cell is the hit target when the stamp opens a record. */
const LEAF_CELL = 28;
const LABEL_WIDTH = 124;

export function Stamp({ tone = "neutral", solid, leaf = true, fill, onClick, href, labelWidth, children, style, ...rest }) {
  const t = TONES[tone];
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = React.useState(false);
  const interactive = !!(onClick || href);
  const Label = href ? "a" : onClick ? "button" : "span";

  const labelProps = interactive
    ? {
        onClick, href,
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false),
        title: typeof children === "string" ? `Open — ${children}` : undefined,
      }
    : {};

  return (
    <span style={{
      display: "inline-flex", alignItems: "stretch", overflow: "hidden",
      borderRadius: "var(--radius-stamp)",
      boxShadow: `inset 0 0 0 1px ${t.border}`, color: t.color,
      background: solid ? t.bg : "var(--surface-raised)",
      lineHeight: 1, whiteSpace: "nowrap", ...style,
    }} {...rest}>
      {leaf ? (
        <span style={{
          width: LEAF_CELL, flex: "0 0 auto",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: t.bg,
          boxShadow: `inset -1px 0 0 ${t.border}`,
        }}>
          <Leaf fill={fill ?? t.fill} id={uid} />
        </span>
      ) : null}
      <Label {...labelProps} style={{
        width: labelWidth ?? LABEL_WIDTH, boxSizing: "border-box",
        padding: "0 10px", height: 28, lineHeight: "28px",
        fontFamily: "var(--font-label)", textTransform: "uppercase",
        fontSize: "var(--type-meta-size)", fontWeight: 600, letterSpacing: "0.09em",
        display: "block", textAlign: "center",
        border: 0, background: hover ? t.bg : "transparent", color: "inherit",
        cursor: interactive ? "pointer" : "default",
        textDecoration: "none",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        transition: "background var(--duration-hover) var(--ease-standard)",
      }}>{children}</Label>
    </span>
  );
}

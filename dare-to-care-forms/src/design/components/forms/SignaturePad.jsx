import React from "react";

/** Signature capture, ported from the application's own field renderer
 *  (dtc-app/dare-to-care-forms/src/components/fields.jsx): DPR-scaled canvas,
 *  2.2px round-capped forest ink, signed-by line and a clear action. */
export function SignaturePad({ label = "Signature", signedBy, onChange, invalid, height = 140, style, ...rest }) {
  const ref = React.useRef(null);
  const drawing = React.useRef(false);
  const last = React.useRef(null);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    const c = ref.current;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f3d2f";
  }, []);

  const pos = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = ref.current.getContext("2d");
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!dirty) setDirty(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty && onChange) onChange({ dataUrl: ref.current.toDataURL("image/png"), signedBy, at: new Date().toISOString() });
  };
  const clear = () => {
    const c = ref.current;
    const rect = c.getBoundingClientRect();
    c.getContext("2d").clearRect(0, 0, rect.width, rect.height);
    setDirty(false);
    if (onChange) onChange(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, ...style }} {...rest}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: "var(--text-mono-size)", letterSpacing: "var(--text-mono-ls)", color: "var(--text-muted)" }}>{label}</span>
        <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        <button type="button" onClick={clear} style={{
          border: 0, background: "transparent", cursor: "pointer", padding: 0,
          fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: "var(--text-mono-size)",
          letterSpacing: "var(--text-mono-ls)", color: "var(--green-700)",
        }}>Clear</button>
      </div>
      <div style={{
        position: "relative", borderRadius: "var(--radius-panel)",
        border: `1px solid ${invalid ? "var(--error-fg)" : "var(--border-default)"}`,
        background: "var(--surface-card)", overflow: "hidden",
      }}>
        <canvas ref={ref}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          style={{ width: "100%", height, display: "block", touchAction: "none", cursor: "crosshair" }} />
        {!dirty ? (
          <span style={{ position: "absolute", left: 16, bottom: 14, fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 15, color: "var(--text-faint)", pointerEvents: "none" }}>Sign here</span>
        ) : null}
        <span style={{ position: "absolute", left: 16, right: 16, bottom: 38, height: 1, background: "var(--border-hair)", pointerEvents: "none" }} />
      </div>
      {signedBy ? <span style={{ fontSize: "var(--text-xs-size)", color: "var(--text-muted)" }}>Signing as {signedBy}</span> : null}
    </div>
  );
}

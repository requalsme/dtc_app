import React, { useEffect, useRef } from 'react';
import { DTC } from './schemas.js';
/* ============================================================
   Dare to Care — shared field renderer + signature pad.
   One component renders every field type from schema.
   Exposes window.DTCFields.
   ============================================================ */


/* ---- Icon set ---- */
const Icon = ({ n, s = 18, sw = 2, style }) => {
  const p = {
    width: s, height: s, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round", style,
  };
  const paths = {
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    pill: <><path d="M10.5 20.5L3.5 13.5a5 5 0 017-7l7 7a5 5 0 01-7 7z" /><path d="M8.5 8.5l7 7" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>,
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></>,
    file: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></>,
    users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></>,
    chevron: <path d="M9 18l6-6-6-6" />,
    chevDown: <path d="M6 9l6 6 6-6" />,
    x: <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>,
    check: <path d="M20 6L9 17l-5-5" />,
    checkCircle: <><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></>,
    sparkle: <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.6L5.7 21 8 14 2 9.6h7.6z" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></>,
    edit: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>,
    wifi: <><path d="M5 12.55a11 11 0 0114 0" /><path d="M8.5 16.1a6 6 0 017 0" /><path d="M12 20h.01" /></>,
    battery: <><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    upload: <><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M4 21h16" /></>,
    download: <><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 21h16" /></>,
    eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></>,
    fileText: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></>,
    layers: <><path d="M12 2L2 7l10 5 10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></>,
    alert: <><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
    refresh: <><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
    arrowLeft: <><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>,
    send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></>,
  };
  return <svg {...p}>{paths[n] || null}</svg>;
};

/* ---- Signature pad (canvas) ---- */
function SignaturePad({ value, onChange, invalid, suggestName }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const dirty = useRef(false);

  const ctxOf = () => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    return { c, ctx };
  };

  useEffect(() => {
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
    // restore existing
    if (value && value.dataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value.dataUrl;
      dirty.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const { ctx } = ctxOf();
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    dirty.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) {
      onChange({ dataUrl: ref.current.toDataURL("image/png"), signedBy: suggestName, at: new Date().toISOString() });
    }
  };
  const clear = () => {
    const { c, ctx } = ctxOf();
    const rect = c.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    dirty.current = false;
    onChange(null);
  };

  return (
    <div className="sigwrap">
      <div className="sigwrap" style={{ position: "relative" }}>
        <canvas
          ref={ref}
          className={"sigpad" + (invalid ? " invalid" : "")}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
        <div className="sigbase" />
        <div className="sig-x">✗</div>
      </div>
      <div className="sig-actions">
        <span className="hint">Sign with finger or mouse</span>
        <button type="button" className="clear" onClick={clear}>Clear</button>
      </div>
      {suggestName ? (
        <div className="sig-suggest">
          <Icon n="sparkle" s={13} />
          Signing as <b style={{ marginLeft: 3 }}>{suggestName}</b> — drawn signature required, never auto-applied.
        </div>
      ) : null}
    </div>
  );
}

/* ---- Autofill chip ---- */
function AutofillChip({ field, ctx, value, onApply }) {
  const suggested = DTC.resolveAutofill(field, ctx);
  if (!suggested || field.type === "signature") return null;
  const applied = value !== undefined && value !== null && String(value) === String(suggested) && String(value) !== "";
  if (applied) {
    return (
      <div className="autofill applied">
        <Icon n="check" s={13} />
        <span>Autofilled from <span className="src">{field.autofill.source}</span></span>
      </div>
    );
  }
  return (
    <div className="autofill">
      <Icon n="sparkle" s={13} />
      <span>Suggest <b>“{String(suggested)}”</b> from <span className="src">{field.autofill.source}</span></span>
      <span className="act">
        <button type="button" className="apply" onClick={() => onApply(suggested)}>Apply</button>
      </span>
    </div>
  );
}

/* ---- Medication table ---- */
function TableField({ field, value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, colId, v) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [colId]: v } : r));
    onChange(next);
  };
  const add = () => onChange([...rows, {}]);
  const del = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="tablefield">
      {rows.map((row, i) => (
        <div className="medrow" key={i}>
          <div className="rh">
            <span className="rn">Medication {i + 1}</span>
            <button type="button" className="del" onClick={() => del(i)} aria-label="Remove"><Icon n="trash" s={15} /></button>
          </div>
          <div className="medgrid">
            {field.columns.map((col) => {
              const wide = col.id === "name" || col.id === "notes";
              return (
                <div className={wide ? "full" : ""} key={col.id}>
                  <span className="mini-l">{col.label}</span>
                  {col.type === "select" ? (
                    <select className="input" value={row[col.id] || ""} onChange={(e) => update(i, col.id, e.target.value)}>
                      <option value="">—</option>
                      {col.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="input" value={row[col.id] || ""} onChange={(e) => update(i, col.id, e.target.value)} placeholder={col.label} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button type="button" className="addrow" onClick={add}>
        <Icon n="plus" s={15} /> Add medication
      </button>
    </div>
  );
}

/* ---- The shared FieldRenderer ---- */
function FieldRenderer({ field, value, onChange, ctx, invalid }) {
  const setVal = (v) => onChange(field.id, v);

  // policyText is its own block (no label row)
  if (field.type === "policyText") {
    return (
      <div className="field">
        <div className="policy">
          <h5>{field.label}</h5>
          <div>{field.body}</div>
        </div>
      </div>
    );
  }

  // computed handled by parent score block — skip here
  if (field.type === "computed") return null;

  const labelRow = (
    <div className="flabel">
      <span>{field.label}</span>
      {field.required ? <span className="req">*</span> : <span className="opt">Optional</span>}
    </div>
  );

  let control = null;
  switch (field.type) {
    case "text":
      control = <input className="input" value={value || ""} placeholder={field.placeholder || ""} onChange={(e) => setVal(e.target.value)} />;
      break;
    case "date":
      control = <input type="date" className="input" value={value || ""} onChange={(e) => setVal(e.target.value)} />;
      break;
    case "textarea":
      control = <textarea className="textarea" value={value || ""} placeholder={field.placeholder || ""} onChange={(e) => setVal(e.target.value)} />;
      break;
    case "select":
      control = (
        <select className="input" value={value || ""} onChange={(e) => setVal(e.target.value)}>
          <option value="">Select…</option>
          {field.options.map((o) => { const l = o.label || o; return <option key={l} value={l}>{l}</option>; })}
        </select>
      );
      break;
    case "radio":
      control = (
        <div className="choices">
          {field.options.map((o) => {
            const sel = value === o.label;
            return (
              <button type="button" key={o.label} className={"choice" + (sel ? " sel" : "")} onClick={() => setVal(o.label)}>
                <span className="mark" />
                <span className="ctxt">{o.label}</span>
                {typeof o.score === "number" && o.score > 0 ? <span className="score">+{o.score}</span> : null}
              </button>
            );
          })}
        </div>
      );
      break;
    case "checkbox": {
      const arr = Array.isArray(value) ? value : [];
      control = (
        <div className="choices">
          {field.options.map((o) => {
            const sel = arr.includes(o.label);
            return (
              <button type="button" key={o.label} className={"choice" + (sel ? " sel" : "")} onClick={() => setVal(sel ? arr.filter((x) => x !== o.label) : [...arr, o.label])}>
                <span className="mark sq" />
                <span className="ctxt">{o.label}</span>
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case "table":
      control = <TableField field={field} value={value} onChange={setVal} />;
      break;
    case "signature": {
      const suggest = field.autofill ? DTC.resolveAutofill(field, ctx) : null;
      control = <SignaturePad value={value} onChange={setVal} invalid={invalid} suggestName={suggest} />;
      break;
    }
    default:
      control = <input className="input" value={value || ""} onChange={(e) => setVal(e.target.value)} />;
  }

  return (
    <div className={"field" + (invalid ? " invalid" : "")}>
      {labelRow}
      {control}
      {field.autofill && field.type !== "signature" ? (
        <AutofillChip field={field} ctx={ctx} value={value} onApply={(v) => setVal(v)} />
      ) : null}
      {invalid ? <div className="field-err">This field is required.</div> : null}
    </div>
  );
}

export { Icon, FieldRenderer };

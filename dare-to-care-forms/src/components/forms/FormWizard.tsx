import { useState, useMemo, useRef, useEffect } from 'react';
// @ts-ignore
import { Icon, FieldRenderer } from '../fields';
// @ts-ignore
import { DTCStore as Store } from '../store';
// @ts-ignore
import { DTC as D } from '../schemas';
import { fmtDate } from '../../utils/format';
import { downloadElementAsPdf, safeFileName } from '../../utils/pdf';

export const getSchema = (key: string) => {
  const template = Store.getTemplate(key);
  const fallback = D.schemas[key];
  if (!template) return fallback;
  return {
    ...fallback,
    ...template,
    sections: template.sections || fallback?.sections || [],
    estMin: template.estMin ?? fallback?.estMin ?? Math.max(2, Math.ceil((template.fieldCount || 6) / 3)),
    interpretation: template.interpretation || fallback?.interpretation,
  };
};

export function displayValue(field: any, value: any) {
  if (value == null || value === "") return null;
  if (field.type === "date") return fmtDate(value);
  if (field.type === "checkbox") return Array.isArray(value) ? (value.length ? value.join(", ") : null) : null;
  if (field.type === "signature") return value && value.dataUrl ? "signed" : null;
  if (field.type === "table") return Array.isArray(value) ? value.filter((r: any) => Object.values(r).some((x) => x)).length + " medication(s)" : null;
  return String(value);
}

// ── Status badges for submission status ────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    submitted: { label: "Submitted", className: "spill ver" },
    reviewed: { label: "Reviewed", className: "spill pub" },
    needsCorrection: { label: "Needs correction", className: "spill warn" },
  };
  const cfg = configs[status] || { label: status, className: "spill" };
  return <span className={cfg.className}><span className="pip" />{cfg.label}</span>;
}

// ── PdfPreview — shown as the in-app document preview step ─────────────────
export function PdfPreview({ schema, values, score, submission }: any) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const doDownload = async () => {
    if (!sheetRef.current) return;
    setDownloading(true);
    try {
      await downloadElementAsPdf(sheetRef.current, `${safeFileName(schema?.name || "form")}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (!schema || !schema.sections || schema.sections.length === 0) {
    return <div className="pdfsheet"><div className="pbody"><p>No form data to preview.</p></div></div>;
  }

  const sigField = schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.type === "signature");
  const sig = sigField ? values[sigField.id] : null;
  const dateField = schema.sections.flatMap((s: any) => s.fields).filter((f: any) => f.type === "date").pop();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button className="btn btn-ghost" onClick={doDownload} disabled={downloading}>
          <Icon n="download" s={15} /> {downloading ? "Preparing PDF…" : "Download PDF"}
        </button>
      </div>
      <div className="pdfsheet" ref={sheetRef}>
        <div className="ph">
          <img src="/logo.png" alt="" />
          <div>
            <div className="pt">{schema.name}</div>
            <div className="ps">DARE TO CARE · v{schema.version} · {fmtDate(D.TODAY_ISO)}</div>
          </div>
          {submission && <StatusBadge status={submission.status} />}
        </div>
        <div className="pbody">
          {/* All sections */}
          {schema.sections.map((sec: any) => {
            // Keep policyText so the full acknowledgement/policy body prints in the document.
            const visible = sec.fields.filter((f: any) => f.type !== "computed");
            if (!visible.length) return null;
            return (
              <div key={sec.id}>
                <h6>{sec.title}</h6>
                {visible.map((f: any) => {
                  const val = values[f.id];
                  if (f.type === "policyText") {
                    return (
                      <div key={f.id} style={{ margin: "4px 0 12px" }}>
                        {f.label ? <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{f.label}</div> : null}
                        <div style={{ fontSize: 11.5, lineHeight: 1.55, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>{f.body}</div>
                      </div>
                    );
                  }
                  if (f.type === "table") {
                    const rows = Array.isArray(val) ? val.filter((r: any) => Object.values(r || {}).some((x) => x)) : [];
                    if (rows.length === 0) return null;
                    return (
                      <div key={f.id}>
                        <div className="pdf-line"><span className="k">{f.label}</span></div>
                        {rows.map((r: any, i: number) => (
                          <div className="pdf-tabline" key={i}>
                            <b>{r.name || "—"}</b> · {r.dose || "?"} · {r.route || "?"} · {r.freq || "?"}
                            {r.time ? " · " + r.time : ""}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  if (f.type === "signature") return null; // shown in signature section
                  const dv = displayValue(f, val);
                  return (
                    <div className="pdf-line" key={f.id}>
                      <span className="k">{f.label}</span>
                      <span className="v">{dv || "—"}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Score */}
          {D.hasScoring(schema) && score.tier ? (
            <>
              <h6>Assessment result</h6>
              <div className="pdf-score">
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Total score &amp; risk level</span>
                <span><span className="sv">{score.total}</span> &nbsp;· {score.tier.label}</span>
              </div>
            </>
          ) : null}

          {/* Signature */}
          <h6>Signature</h6>
          {sig && sig.dataUrl ? (
            <div className="pdf-sig">
              <img src={sig.dataUrl} alt="signature" />
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                {sig.signedBy ? sig.signedBy + " · " : ""}
                {dateField ? fmtDate(values[dateField.id]) : ""}
              </div>
            </div>
          ) : <div className="pdf-line"><span className="v empty">No signature</span></div>}

          {/* Correction history */}
          {submission?.correctionHistory?.length > 0 && (
            <>
              <h6 style={{ color: "var(--amber)" }}>Correction history</h6>
              {submission.correctionHistory.map((entry: any, i: number) => (
                <div className="pdf-line" key={i} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                  <span className="k">{new Date(entry.timestamp).toLocaleString()} · {entry.actorName}</span>
                  <span className="v">{entry.status === "needsCorrection" ? "Correction requested" : "Resubmitted"}
                    {entry.note ? ` — "${entry.note}"` : ""}</span>
                </div>
              ))}
            </>
          )}

          {/* Office review */}
          {submission?.reviewedBy && (
            <>
              <h6 style={{ color: "var(--accent)" }}>Office review</h6>
              <div className="pdf-line"><span className="k">Reviewed by</span><span className="v">{submission.reviewedBy}</span></div>
              {submission.reviewedAt && <div className="pdf-line"><span className="k">Review date</span><span className="v">{new Date(submission.reviewedAt).toLocaleString()}</span></div>}
            </>
          )}
        </div>
      </div>
      <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
        Use “Download PDF” above to save the complete document — all policy text, your entries, and the signature — as a branded PDF.
      </p>
    </div>
  );
}

// ── ScoreBlock ────────────────────────────────────────────────────────────

export function ScoreBlock({ score }: any) {
  if (!score.tier) {
    return (
      <div className="scoreblock">
        <div className="top"><span className="lbl">Total score</span><span className="big">{score.total}</span></div>
      </div>
    );
  }
  return (
    <div className="scoreblock">
      <div className="top"><span className="lbl">Total score · recalculates live</span><span className="big">{score.total}</span></div>
      <div className={"tier " + score.tier.level}><span className="pip" />{score.tier.label}</div>
    </div>
  );
}

// ── ReviewStep ────────────────────────────────────────────────────────────

function ReviewStep({ schema, values, score, onEdit }: any) {
  return (
    <div>
      {D.hasScoring(schema) ? <ScoreBlock schema={schema} score={score} /> : null}
      {schema.sections.map((sec: any, i: number) => {
        const visible = sec.fields.filter((f: any) => f.type !== "computed" && f.type !== "policyText");
        if (!visible.length) return null;
        return (
          <div className="reviewsec" key={sec.id}>
            <div className="rs-h"><span className="t">{sec.title}</span><button className="edit" onClick={() => onEdit(i)}>Edit</button></div>
            <div className="card">
              {visible.map((f: any) => {
                const dv = displayValue(f, values[f.id]);
                if (f.type === "signature") {
                  return (
                    <div className="rev-row" key={f.id}>
                      <span className="k">{f.label}</span>
                      {values[f.id] && values[f.id].dataUrl
                        ? <img src={values[f.id].dataUrl} alt="signature" style={{ height: 34 }} />
                        : <span className="v empty">not signed</span>}
                    </div>
                  );
                }
                return (
                  <div className="rev-row" key={f.id}>
                    <span className="k">{f.label}</span>
                    <span className={"v" + (dv ? "" : " empty")}>{dv || "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="autofill applied" style={{ marginTop: 4 }}>
        <Icon n="lock" s={13} /><span>On submit, this is filed as an immutable, audited record.</span>
      </div>
    </div>
  );
}

// ── SectionStep ───────────────────────────────────────────────────────────

function SectionStep({ section, values, setField, ctx, invalidIds, score, schema, setValues }: any) {
  const pending = section.fields.filter((f: any) => {
    if (!f.autofill || !f.autofill.safe || f.type === "signature") return false;
    const sug = D.resolveAutofill(f, ctx);
    return sug != null && String(values[f.id] ?? "") !== String(sug);
  });
  const applyAll = () => setValues((p: any) => {
    const next = { ...p };
    pending.forEach((f: any) => { next[f.id] = D.resolveAutofill(f, ctx); });
    return next;
  });
  const hasComputed = section.fields.some((f: any) => f.type === "computed");
  return (
    <div>
      {pending.length > 1 ? (
        <div className="autobulk">
          <Icon n="sparkle" s={18} />
          <span className="t"><b>{pending.length} fields</b> can be autofilled from {ctx.client ? "the client profile" : "your profile"} &amp; today's date.</span>
          <button onClick={applyAll}>Apply all</button>
        </div>
      ) : null}
      {section.fields.map((f: any) => (
        <FieldRenderer key={f.id} field={f} value={values[f.id]} onChange={setField} ctx={ctx} invalid={invalidIds.includes(f.id)} />
      ))}
      {hasComputed ? <ScoreBlock schema={schema} score={score} /> : null}
    </div>
  );
}

// ── WizardIntro ────────────────────────────────────────────────────────────

function WizardIntro({ schema, needsClient, client, setClient }: any) {
  return (
    <div>
      <div className="wizintro">
        <div className="ic"><Icon n={schema.icon} s={26} /></div>
        <h3>{schema.name}</h3>
        <p>{schema.interpretation?.purpose}</p>
        <div className="facts">
          <div className="f"><b>{schema.estMin} min</b>est. time</div>
          <div className="f"><b>{schema.sections.length}</b>sections</div>
          <div className="f"><b>{schema.category}</b>record</div>
        </div>
      </div>
      {needsClient ? (
        <div>
          <div className="section-label" style={{ marginTop: 6 }}>Select client</div>
          {Store.clients.map((c: any) => (
            <button key={c.id} className={"clientopt" + (client && client.id === c.id ? " sel" : "")} onClick={() => setClient(c)}>
              <span className="ci">{c.initials}</span>
              <span className="cinfo">
                <span className="nm">{c.name}</span>
                <span className="meta">DOB {fmtDate(c.dob)} · MRN {c.mrn}</span>
                {c.allergies && <span className="meta" style={{ color: "var(--amber)", fontSize: 11 }}>⚠ {c.allergies}</span>}
              </span>
              <Icon n="checkCircle" s={20} style={{ color: "var(--accent)" }} />
              <span className="check" />
            </button>
          ))}
        </div>
      ) : (
        <div className="card" style={{ background: "var(--surface-3)", textAlign: "center", fontSize: 13, color: "var(--ink-2)" }}>
          This form is about you — no client needs to be selected.
        </div>
      )}
    </div>
  );
}

// ── FormWizard — main component ────────────────────────────────────────────

export function FormWizard({
  schemaKey, initialClient, onClose, onSubmit,
  autoApply, submitLabel = "Submit & file",
  isSubmitting = false, isResubmit = false,
  prefillValues, correctionNote,
}: any) {
  const schema = getSchema(schemaKey);
  const needsClient = schema.subject === "client";

  const [client, setClient] = useState(initialClient || null);
  const [values, setValues] = useState<any>(prefillValues || {});
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ctx = { currentUser: D.currentUser, client };

  const appliedRef = useRef(false);
  useEffect(() => {
    if (!autoApply) return;
    if (needsClient && !client) return;
    if (appliedRef.current) return;
    appliedRef.current = true;
    setValues((prev: any) => {
      const next = { ...prev };
      schema.sections.forEach((sec: any) => sec.fields.forEach((f: any) => {
        if (f.autofill && f.autofill.safe) {
          const v = D.resolveAutofill(f, { currentUser: D.currentUser, client });
          if (v != null && next[f.id] === undefined) next[f.id] = v;
        }
      }));
      return next;
    });
  }, [client, autoApply, needsClient, schema.sections]);

  const nSec = schema.sections.length;
  const REVIEW = nSec + 1;
  const PDF = nSec + 2;
  const total = PDF;
  const setField = (id: string, v: any) => setValues((p: any) => ({ ...p, [id]: v }));
  const scrollTop = () => { if (bodyRef.current) bodyRef.current.scrollTop = 0; };
  const score = useMemo(() => D.computeScore(schema, values), [values, schema]);

  const curSection = step >= 1 && step <= nSec ? schema.sections[step - 1] : null;
  const invalidIds = curSection ? D.invalidFieldsInSection(curSection, values) : [];
  const canAdvance = step === 0 ? (!needsClient || !!client) : curSection ? invalidIds.length === 0 : true;

  const goNext = () => {
    if (!canAdvance) { setTried(true); return; }
    setTried(false); setStep((s) => Math.min(s + 1, total)); scrollTop();
  };
  const goBack = () => {
    if (step === 0) { onClose(); return; }
    setTried(false); setStep((s) => s - 1); scrollTop();
  };

  const stepLabel = step === 0 ? "Get started"
    : step <= nSec ? `Step ${step} of ${nSec}`
    : step === REVIEW ? "Review & sign-off"
    : "Document preview";
  const sectionTitle = step === 0 ? schema.name
    : step <= nSec ? schema.sections[step - 1].title
    : step === REVIEW ? "Review" : "Branded PDF";

  // Progress percentage
  const progressPct = Math.round((step / total) * 100);

  return (
    <div className="wizard">
      {/* Correction banner if resubmitting */}
      {isResubmit && correctionNote && (
        <div className="correction-banner-wiz">
          <Icon n="alert" s={16} />
          <span><strong>Correction needed:</strong> {correctionNote}</span>
        </div>
      )}

      <div className="wiz-head">
        <div className="row">
          <button className="x" onClick={onClose} aria-label="Close"><Icon n="x" s={18} /></button>
          <span className="formname">{schema.name}</span>
          <span style={{ width: 34 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
          <span className="step-k">{stepLabel}</span>
          {client ? <span className="step-k" style={{ color: "var(--ink-3)" }}>{client.name}</span> : null}
        </div>
        <div className="sectitle">{sectionTitle}</div>
        {/* Progress bar */}
        <div className="wiz-progress">
          <div className="wiz-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="wiz-body" ref={bodyRef}>
        {step === 0 ? (
          <WizardIntro schema={schema} needsClient={needsClient} client={client} setClient={setClient} />
        ) : step <= nSec ? (
          <SectionStep
            section={schema.sections[step - 1]} values={values} setField={setField} ctx={ctx}
            invalidIds={tried ? invalidIds : []} score={score} schema={schema} setValues={setValues}
          />
        ) : step === REVIEW ? (
          <ReviewStep schema={schema} values={values} score={score} onEdit={(i: number) => { setStep(i + 1); scrollTop(); }} />
        ) : (
          <PdfPreview schema={schema} values={values} score={score} />
        )}
      </div>

      <div className="wiz-foot">
        <button className="btn btn-ghost" onClick={goBack}>{step === 0 ? "Cancel" : "Back"}</button>
        {step < REVIEW ? (
          <button className="btn btn-primary" onClick={goNext} disabled={step === 0 && needsClient && !client}>Continue</button>
        ) : step === REVIEW ? (
          <button className="btn btn-primary" onClick={goNext}>Preview PDF</button>
        ) : (
          <button className="btn btn-primary" disabled={isSubmitting} onClick={() => onSubmit({ schema, values, score, client })}>
            <Icon n="check" s={17} /> {submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── RecordViewer ──────────────────────────────────────────────────────────

export function RecordViewer({ sub, onClose, onResubmit }: any) {
  const schema = getSchema(sub.schemaKey);
  const needsCorrection = sub.status === "needsCorrection";

  return (
    <div className="wizard">
      <div className="wiz-head">
        <div className="row">
          <button className="x" onClick={onClose}><Icon n="x" s={18} /></button>
          <span className="formname">Filed record</span>
          <span style={{ width: 34 }} />
        </div>
        <div className="sectitle">{schema?.name}</div>
        {needsCorrection && sub.correctionNote && (
          <div style={{ marginTop: 6, padding: "8px 12px", background: "var(--amber-light)", borderRadius: 8, fontSize: 12.5, color: "var(--amber-dark)", lineHeight: 1.5 }}>
            <strong>Correction requested:</strong> {sub.correctionNote}
          </div>
        )}
      </div>
      <div className="wiz-body">
        <PdfPreview schema={schema} values={sub.values} score={sub.score} submission={sub} />
        {sub.pdfUrl ? (
          <div className="record-actions">
            <a className="btn btn-ghost btn-block" href={sub.pdfUrl} target="_blank" rel="noreferrer">
              <Icon n="download" s={16} /> Open stored PDF
            </a>
          </div>
        ) : null}
      </div>
      <div className="wiz-foot">
        {needsCorrection && onResubmit ? (
          <button className="btn btn-primary btn-block" onClick={() => onResubmit(sub)} style={{ background: "var(--amber)" }}>
            <Icon n="edit" s={16} /> Fix &amp; resubmit
          </button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={onClose}>Done</button>
        )}
      </div>
    </div>
  );
}

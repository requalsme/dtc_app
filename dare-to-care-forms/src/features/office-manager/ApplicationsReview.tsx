// ── ApplicationsReview ──────────────────────────────────────────────────────
//
// Employment applications submitted on careers.daretocarehomecare.com
// (dtc-jobapp, a separate Netlify site) land in this project's `applications`
// Firestore collection and show up here. Shared between the Office Manager
// and Admin nav — same component, same data, both routes just mount it.
//
// Scope is deliberately narrow: view what came in, mark it reviewed. Turning
// a reviewed application into a hired new-hire account is a separate,
// heavier decision (creating a login, starting a packet) and is not this
// screen's job — see NewHireReview for what happens once someone is actually
// hired on.

import { useEffect, useMemo, useState } from "react";
// @ts-ignore
import { Icon } from "../../components/fields.jsx";
// @ts-ignore
import { DTCStore as Store } from "../../components/store.js";
import { fmtDate } from "../../utils/format";

const relTime = (iso: string) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return fmtDate(iso.slice(0, 10));
};

// Field keys that already have a dedicated place in the header or are
// internal bookkeeping — kept out of the generic "everything else" list so
// that list doesn't repeat the applicant's name three times.
const HIDDEN_FIELD_KEYS = new Set(["firstName", "lastName", "email", "position"]);

function fieldLabel(key: string) {
  // "dateOfBirth" -> "Date of birth" — same de-camel-casing the rest of the
  // app doesn't need because schema-driven forms carry their own labels;
  // application data is a plain object with no schema attached.
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function statusChip(status: string) {
  if (status === "reviewed") return <span className="spill pub"><span className="pip" />Reviewed</span>;
  return <span className="spill ver"><span className="pip" />Submitted</span>;
}

// ── File row ─────────────────────────────────────────────────────────────

function FileRow({ label, blobKey, sizeBytes }: { label: string; blobKey: string; sizeBytes?: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = async () => {
    setBusy(true);
    setError("");
    try {
      const url = await Store.applicationFileUrl(blobKey);
      window.open(url, "_blank", "noreferrer");
    } catch (err: any) {
      setError(err?.message || "Could not open file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13 }}>
        {label}
        {sizeBytes ? <span style={{ color: "var(--ink-3)" }}> · {Math.round(sizeBytes / 1024)} KB</span> : null}
      </span>
      <button className="dbtn dbtn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} disabled={busy} onClick={open}>
        <Icon n="eye" s={13} /> {busy ? "Opening…" : "View"}
      </button>
      {error && <div className="form-error" style={{ marginLeft: 10 }}>{error}</div>}
    </div>
  );
}

// ── Detail ───────────────────────────────────────────────────────────────

function ApplicationDetail({ application, onClose, onToast }: { application: any; onClose: () => void; onToast: (m: string) => void }) {
  const [liveApp, setLiveApp] = useState(application);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    return Store.subscribe(() => {
      const fresh = Store.getApplications().find((a: any) => a.id === application.id);
      if (fresh) setLiveApp(fresh);
    });
  }, [application.id]);

  const markReviewed = async () => {
    setBusy(true);
    try {
      await Store.markApplicationReviewed(liveApp.id, note.trim() || undefined);
      onToast(`${liveApp.applicant}'s application marked reviewed`);
      onClose();
    } catch (err: any) {
      onToast(err?.message || "Could not mark reviewed");
    } finally {
      setBusy(false);
    }
  };

  const data = liveApp.data || {};
  const otherFields = Object.keys(data).filter((k) => !HIDDEN_FIELD_KEYS.has(k) && data[k]);

  return (
    <div>
      <div className="ds-ph">
        <div>
          <button className="dbtn dbtn-ghost" style={{ marginBottom: 10, padding: "6px 12px", fontSize: 12 }} onClick={onClose}>
            <Icon n="arrowLeft" s={14} /> All applications
          </button>
          <h1>{liveApp.applicant}</h1>
          <p>
            {liveApp.position || "Position not specified"} · applied {relTime(liveApp.submittedAt)}
            {liveApp.email && <> · {liveApp.email}</>}
            {liveApp.reviewedBy && <span> · Reviewed by {liveApp.reviewedBy}</span>}
          </p>
        </div>
        <div className="actions">
          {liveApp.status === "submitted" ? (
            <button className="dbtn dbtn-primary" disabled={busy} onClick={markReviewed}>
              <Icon n="check" s={15} /> {busy ? "Marking…" : "Mark reviewed"}
            </button>
          ) : (
            statusChip(liveApp.status)
          )}
        </div>
      </div>

      {liveApp.status === "submitted" && (
        <div className="ds-panel" style={{ padding: 16, marginBottom: 16 }}>
          <label className="form-label" htmlFor="app-note">Review note (optional)</label>
          <textarea
            id="app-note"
            className="insp-input"
            rows={2}
            placeholder="e.g. Strong background, schedule a phone screen."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}

      {liveApp.reviewNote && (
        <div className="ds-panel" style={{ padding: 16, marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>Review note</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", fontStyle: "italic" }}>"{liveApp.reviewNote}"</div>
        </div>
      )}

      <div style={{ maxWidth: 700 }}>
        <div className="ds-panel" style={{ padding: 16, marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Application details</div>
          {liveApp.ssn_last4 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>SSN</span>
              <span style={{ fontSize: 13 }}>••• •• {liveApp.ssn_last4}</span>
            </div>
          )}
          {otherFields.map((k) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{fieldLabel(k)}</span>
              <span style={{ fontSize: 13, textAlign: "right" }}>{String(data[k])}</span>
            </div>
          ))}
          {otherFields.length === 0 && !liveApp.ssn_last4 && (
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No additional fields recorded.</div>
          )}
        </div>

        <div className="ds-panel" style={{ padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Documents</div>
          {liveApp.pdf?.storagePath && (
            <FileRow label="Full application packet (PDF)" blobKey={liveApp.pdf.storagePath} />
          )}
          {(liveApp.files || []).map((f: any) => (
            <FileRow key={f.storagePath} label={f.originalName || f.field} blobKey={f.storagePath} sizeBytes={f.sizeBytes} />
          ))}
          {!liveApp.pdf?.storagePath && (liveApp.files || []).length === 0 && (
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No files on this application.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────

export function ApplicationsReview({ onToast }: { onToast: (m: string) => void }) {
  const [, force] = useState(0);
  const [viewing, setViewing] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const applications = Store.getApplications();

  const filtered = useMemo(() => {
    return applications
      .filter((a: any) => {
        if (filterStatus && a.status !== filterStatus) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!a.applicant?.toLowerCase().includes(q) && !a.position?.toLowerCase().includes(q) && !a.email?.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
  }, [applications, filterStatus, search]);

  if (viewing) {
    return <ApplicationDetail application={viewing} onClose={() => setViewing(null)} onToast={onToast} />;
  }

  const pendingCount = applications.filter((a: any) => a.status === "submitted").length;

  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>Applications</h1>
          <p>
            {applications.length} received from careers.daretocarehomecare.com
            {pendingCount > 0 && ` · ${pendingCount} awaiting review`}
          </p>
        </div>
      </div>

      <div className="ds-filters">
        <input className="ds-search" placeholder="Search by name, position, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="ds-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      <div className="ds-panel">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Position</th>
              <th>Applied</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a: any) => (
              <tr key={a.id} onClick={() => setViewing(a)}>
                <td>
                  <span className="row-ic">
                    <span className="ti"><Icon n="users" s={16} /></span>
                    <span>
                      <span className="cell-main">{a.applicant}</span>
                      <span className="cell-sub">{a.email}</span>
                    </span>
                  </span>
                </td>
                <td style={{ color: "var(--ink-2)" }}>{a.position || "—"}</td>
                <td style={{ color: "var(--ink-3)", fontSize: 12 }}>{relTime(a.submittedAt)}</td>
                <td>{statusChip(a.status)}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="dbtn dbtn-ghost" style={{ padding: "6px 11px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setViewing(a); }}>
                    <Icon n="eye" s={13} /> View
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--ink-3)" }}>
                {applications.length === 0 ? "No applications yet." : "No applications match the current filters."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

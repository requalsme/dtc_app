// ── ApplicationsReview ──────────────────────────────────────────────────────
//
// Employment applications submitted on careers.daretocarehomecare.com
// (dtc-jobapp, a separate Netlify site) land in this project's `applications`
// table and show up here. Shared between the Office Manager and Admin nav —
// same component, same data, both routes just mount it.
//
// Scope is deliberately narrow: view what came in, mark it reviewed. Turning
// a reviewed application into a hired new-hire account is a separate, heavier
// decision (creating a login, starting a packet) and is not this screen's job
// — see NewHireReview for what happens once someone is actually hired on.
//
// The applicant's identifying details are the sensitive part of this screen.
// The full SSN is never held here; only its last four digits are stored, and
// they are shown masked, because the number's real purpose is the state
// background checks and those are run elsewhere.

import { useEffect, useMemo, useState } from "react";
// @ts-ignore
import { DTCStore as Store } from "../../components/store.js";
import { fmtDate } from "../../utils/format";
import {
  Icon, Button, Stamp, MonoLabel, Panel, Input, Select, Textarea,
  RecordRow, EmptyState, Chip, Text,
  // @ts-ignore - design system is untyped JSX
} from "../../design/index.js";
// @ts-ignore - untyped JSX
import { SheetHeader, useAreaLabel } from "../../console/Chrome.jsx";

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

const StatusStamp = ({ status }: { status: string }) =>
  status === "reviewed"
    ? <Stamp tone="success">Reviewed</Stamp>
    : <Stamp tone="brand">Submitted</Stamp>;

/** One fact from the application, label left and value right. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", gap: 16, alignItems: "baseline", justifyContent: "space-between",
      padding: "10px 0", borderTop: "1px solid var(--border-hair)",
    }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 13.5, color: "var(--text-body)", textAlign: "right", wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
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
    <div>
      <RecordRow
        icon={<Icon name="file" size={17} />}
        title={label}
        subtitle={sizeBytes ? `${Math.round(sizeBytes / 1024)} KB` : ""}
        actions={
          <Button size="sm" variant="outline" disabled={busy} iconLeft={<Icon name="eye" size={14} />} onClick={open}>
            {busy ? "Opening…" : "View"}
          </Button>
        }
      />
      {error && (
        <Text role="body" style={{ fontSize: 12.5, color: "var(--status-danger)", display: "block", marginTop: 6 }}>
          {error}
        </Text>
      )}
    </div>
  );
}

// ── Detail ───────────────────────────────────────────────────────────────

function ApplicationDetail({ application, onClose, onToast }: { application: any; onClose: () => void; onToast: (m: string) => void }) {
  const area = useAreaLabel();
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
  const files = liveApp.files || [];
  const hasFiles = !!liveApp.pdf?.storagePath || files.length > 0;
  const pending = liveApp.status === "submitted";

  return (
    <>
      <SheetHeader
        eyebrow={`${area} / Applications / ${liveApp.applicant}`}
        title={liveApp.applicant}
        lead={[
          liveApp.position || "Position not specified",
          `applied ${relTime(liveApp.submittedAt)}`,
          liveApp.reviewedBy ? `reviewed by ${liveApp.reviewedBy}` : null,
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="outline" iconLeft={<Icon name="arrowLeft" size={16} />} onClick={onClose}>
              All applications
            </Button>
            {pending && (
              <Button disabled={busy} iconLeft={<Icon name="check" size={16} />} onClick={markReviewed}>
                {busy ? "Marking…" : "Mark reviewed"}
              </Button>
            )}
          </>
        }
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
        <StatusStamp status={liveApp.status} />
        {liveApp.email && <Chip icon={<Icon name="send" size={14} />}>{liveApp.email}</Chip>}
        {liveApp.phone && <Chip icon={<Icon name="idCard" size={14} />}>{liveApp.phone}</Chip>}
      </div>

      <div className="split" style={{ alignItems: "start" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <Panel label="What they told us">
            {liveApp.ssn_last4 && (
              <Fact
                label="SSN"
                value={
                  <span style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
                    ••• •• {liveApp.ssn_last4}
                  </span>
                }
              />
            )}
            {otherFields.map((k) => (
              <Fact key={k} label={fieldLabel(k)} value={String(data[k])} />
            ))}
            {otherFields.length === 0 && !liveApp.ssn_last4 && (
              <Text role="body" color="quiet" style={{ fontSize: 13.5 }}>
                No additional fields were recorded on this application.
              </Text>
            )}
          </Panel>

          <div>
            <MonoLabel rule count={files.length + (liveApp.pdf?.storagePath ? 1 : 0)} style={{ marginBottom: 12 }}>
              Documents
            </MonoLabel>
            {!hasFiles ? (
              <Text role="body" color="quiet" style={{ fontSize: 13.5 }}>
                No files came with this application.
              </Text>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {liveApp.pdf?.storagePath && (
                  <FileRow label="Full application packet (PDF)" blobKey={liveApp.pdf.storagePath} />
                )}
                {files.map((f: any) => (
                  <FileRow key={f.storagePath} label={f.originalName || f.field} blobKey={f.storagePath} sizeBytes={f.sizeBytes} />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {pending && (
            <Panel label="Review note">
              <Textarea
                rows={3}
                placeholder="e.g. Strong background, schedule a phone screen."
                value={note}
                onChange={(e: any) => setNote(e.target.value)}
                hint="Optional. Saved against the application when you mark it reviewed."
              />
              <Button
                fullWidth
                style={{ marginTop: 14 }}
                disabled={busy}
                iconLeft={<Icon name="check" size={16} />}
                onClick={markReviewed}
              >
                {busy ? "Marking…" : "Mark reviewed"}
              </Button>
            </Panel>
          )}

          {liveApp.reviewNote && (
            <Panel label="Review note" tone="sunken">
              <Text role="body" color="secondary" style={{ fontSize: 13.5, lineHeight: 1.6, fontStyle: "italic" }}>
                “{liveApp.reviewNote}”
              </Text>
            </Panel>
          )}

          <Panel label="What happens next" tone="sunken">
            <Text role="body" color="secondary" style={{ fontSize: 13, lineHeight: 1.65 }}>
              Marking an application reviewed records that somebody has read it. Hiring is a
              separate step — creating a login and starting a new-hire packet happens on the
              New hires screen, not here.
            </Text>
          </Panel>
        </aside>
      </div>
    </>
  );
}

// ── List ─────────────────────────────────────────────────────────────────

export function ApplicationsReview({ onToast }: { onToast: (m: string) => void }) {
  const area = useAreaLabel();
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
    <>
      <SheetHeader
        eyebrow={`${area} / Applications`}
        title="Applications"
        lead={`Everyone who has applied through careers.daretocarehomecare.com.${
          pendingCount > 0 ? ` ${pendingCount} ${pendingCount === 1 ? "is" : "are"} waiting to be read.` : ""
        }`}
      />

      <div style={{ display: "flex", gap: 12, margin: "0 0 26px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 300 }}>
          <Input
            placeholder="Search by name, position, email"
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            iconLeft={<Icon name="search" size={17} />}
          />
        </div>
        <div style={{ width: 190 }}>
          <Select
            value={filterStatus}
            onChange={(e: any) => setFilterStatus(e.target.value)}
            options={[
              { value: "", label: "All statuses" },
              { value: "submitted", label: "Awaiting review" },
              { value: "reviewed", label: "Reviewed" },
            ]}
          />
        </div>
        <span style={{ flex: 1 }} />
        <MonoLabel count={pendingCount}>Awaiting review</MonoLabel>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={applications.length === 0 ? "No applications yet" : "Nothing matches that"}
          description={applications.length === 0
            ? "Applications submitted on the careers site land here automatically."
            : "Try a different search, or clear the status filter."}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 880 }}>
          {filtered.map((a: any) => (
            <RecordRow
              key={a.id}
              icon={<Icon name="users" size={17} />}
              title={a.applicant}
              subtitle={[a.position, a.email].filter(Boolean).join(" · ")}
              meta={relTime(a.submittedAt)}
              stamp={<StatusStamp status={a.status} />}
              accentEdge={a.status === "submitted"}
              onClick={() => setViewing(a)}
            />
          ))}
        </div>
      )}
    </>
  );
}

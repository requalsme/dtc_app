import { useEffect, useState } from "react";
// @ts-ignore
import { Icon } from "../../components/fields";
// @ts-ignore
import { DTCStore as Store } from "../../components/store";
import { InboundTile } from "./InboundTile";

function SummaryCard({ icon, label, value, tone, onClick }: { icon: string; label: string; value: number | string; tone?: string; onClick?: () => void }) {
  return (
    <div className={`admin-stat-card${tone ? ` ${tone}` : ""}${onClick ? " clickable" : ""}`} onClick={onClick}>
      <div className="admin-stat-icon"><Icon n={icon} s={17} /></div>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

export function OfficeDashboard({ onStartForm, onNav }: { onStartForm?: () => void; onNav?: (page: string) => void }) {
  const [submissions, setSubmissions] = useState(Store.getSubmissions());
  const [tasks, setTasks] = useState(Store.getTasks ? Store.getTasks() : []);
  const [audit, setAudit] = useState(Store.getAudit());
  const [inboundPending, setInboundPending] = useState(
    Store.getPendingInbound ? Store.getPendingInbound() : [],
  );
  const [applicationsPending, setApplicationsPending] = useState(
    Store.getPendingApplications ? Store.getPendingApplications() : [],
  );

  useEffect(() => {
    return Store.subscribe(() => {
      setSubmissions(Store.getSubmissions());
      setTasks(Store.getTasks ? Store.getTasks() : []);
      setAudit(Store.getAudit());
      setInboundPending(Store.getPendingInbound ? Store.getPendingInbound() : []);
      setApplicationsPending(Store.getPendingApplications ? Store.getPendingApplications() : []);
    });
  }, []);

  const pendingReview = submissions.filter((s: any) => s.status === "submitted");
  const corrections = submissions.filter((s: any) => s.status === "needsCorrection");
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter((t: any) => t.status === "pending" && t.dueDate < today);

  return (
    <div className="screen">
      <div className="dashboard-hero compact">
        <div className="dashboard-hero-copy">
          <h2>Office dashboard</h2>
        </div>
        {onStartForm && (
          <div style={{ marginTop: 16 }}>
            <button className="dbtn dbtn-primary" onClick={onStartForm}>
              <Icon n="plus" s={16} /> Start supervisory visit
            </button>
          </div>
        )}
      </div>

      <div className="admin-stat-grid">
        <SummaryCard icon="inbox" label="Pending review" value={pendingReview.length} tone={pendingReview.length > 0 ? "soft-amber" : ""} />
        <SummaryCard icon="alert" label="Corrections open" value={corrections.length} tone={corrections.length > 0 ? "soft-warn" : ""} />
        <SummaryCard icon="clock" label="Overdue tasks" value={overdueTasks.length} tone={overdueTasks.length > 0 ? "soft-warn" : ""} />
        {/* Documents that arrived from outside the app. This sits alongside the
            other counts because it is the same job — work waiting on a person —
            and because for compliance evidence it is currently the only pipe:
            CareTime holds no documents at all for the 50 people on the roster. */}
        <SummaryCard
          icon="download"
          label="Waiting to file"
          value={inboundPending.length}
          tone={inboundPending.length > 0 ? "soft-amber" : ""}
          onClick={onNav ? () => onNav("inbound") : undefined}
        />
        <SummaryCard
          icon="users"
          label="New applications"
          value={applicationsPending.length}
          tone={applicationsPending.length > 0 ? "soft-amber" : ""}
          onClick={onNav ? () => onNav("applications") : undefined}
        />
        <SummaryCard icon="users" label="Clients in scope" value={Store.clients.length} />
      </div>

      {/* Above the other panels on purpose. These documents are the ones with a
          clock on them — an authorization sitting unread is how a start of care
          slips — and unlike a submission, nothing has happened to them yet. */}
      <div style={{ marginTop: 20 }}>
        <InboundTile onOpen={onNav ? () => onNav("inbound") : undefined} />
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h3>Latest submissions</h3>
              <p>Recently filed records waiting for office review.</p>
            </div>
          </div>
          <div className="admin-queue-list">
            {submissions.slice(0, 8).map((s: any) => (
              <div className="admin-queue-row" key={s.id}>
                <div>
                  <strong>{s.templateName || s.schemaKey}</strong>
                  <span>{s.clientName || "Employee form"} · {s.caregiverName}</span>
                </div>
                <span className={`ui-tag${
                  s.status === "needsCorrection" ? " warn" :
                  s.status === "reviewed" ? " pub" : ""
                }`}>
                  {s.status === "needsCorrection" ? "Correction" :
                   s.status === "reviewed" ? "Reviewed" : "Submitted"}
                </span>
              </div>
            ))}
            {submissions.length === 0 && (
              <div className="admin-empty-inline">No submissions yet.</div>
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h3>Operations trail</h3>
              <p>Recent role activity across reviews, sign-ins, and publishing.</p>
            </div>
          </div>
          <div className="admin-activity-list">
            {audit.slice(0, 8).map((event: any) => (
              <div key={event.id} className="admin-activity-row">
                <div className="admin-activity-icon">
                  <Icon n={
                    event.action.includes("template") ? "layers" :
                    event.action.includes("client") ? "users" :
                    event.action.includes("submission") || event.action.includes("form") ? "fileText" :
                    event.action.includes("task") ? "clock" : "lock"
                  } s={14} />
                </div>
                <div className="admin-activity-copy">
                  <strong>{event.target}</strong>
                  <span>{event.actor} · {event.action.replaceAll("_", " ")}</span>
                </div>
                <span className="admin-activity-role">{event.role}</span>
              </div>
            ))}
            {audit.length === 0 && <div className="admin-empty-inline">No audit events yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

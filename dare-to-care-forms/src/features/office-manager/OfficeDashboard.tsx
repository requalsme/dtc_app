import { useEffect, useState } from "react";
// @ts-ignore
import { Icon } from "../../components/fields";
// @ts-ignore
import { DTCStore as Store } from "../../components/store";

function SummaryCard({ icon, label, value, tone, onClick }: { icon: string; label: string; value: number | string; tone?: string; onClick?: () => void }) {
  return (
    <div className={`admin-stat-card${tone ? ` ${tone}` : ""}${onClick ? " clickable" : ""}`} onClick={onClick}>
      <div className="admin-stat-icon"><Icon n={icon} s={17} /></div>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

export function OfficeDashboard({ onStartForm }: { onStartForm?: () => void }) {
  const [submissions, setSubmissions] = useState(Store.getSubmissions());
  const [tasks, setTasks] = useState(Store.getTasks ? Store.getTasks() : []);
  const [audit, setAudit] = useState(Store.getAudit());

  useEffect(() => {
    return Store.subscribe(() => {
      setSubmissions(Store.getSubmissions());
      setTasks(Store.getTasks ? Store.getTasks() : []);
      setAudit(Store.getAudit());
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
          <span className="dashboard-hero-kicker">Office oversight</span>
          <h2>Watch the daily filing pulse and close the loop on every visit record.</h2>
          <p>Submissions, corrections, and signed PDFs stay centralized so the office can review quickly and keep the care timeline complete.</p>
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
        <SummaryCard icon="users" label="Clients in scope" value={Store.clients.length} />
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

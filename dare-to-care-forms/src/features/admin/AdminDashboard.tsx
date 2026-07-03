import { useEffect, useState } from "react";
// @ts-ignore
import { Icon } from "../../components/fields";
// @ts-ignore
import { DTCStore as Store } from "../../components/store";

function StatCard({ icon, label, value, tone }: { icon: string; label: string; value: number; tone?: string }) {
  return (
    <div className={`admin-stat-card${tone ? ` ${tone}` : ""}`}>
      <div className="admin-stat-icon">
        <Icon n={icon} s={18} />
      </div>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

export function AdminDashboard() {
  const [submissions, setSubmissions] = useState(Store.getSubmissions());
  const [templates, setTemplates] = useState(Store.getTemplates());
  const [audit, setAudit] = useState(Store.getAudit());

  useEffect(() => {
    return Store.subscribe(() => {
      setSubmissions(Store.getSubmissions());
      setTemplates(Store.getTemplates());
      setAudit(Store.getAudit());
    });
  }, []);

  const published = templates.filter((template: any) => template.status === "published");
  const drafts = templates.filter((template: any) => template.status !== "published");
  const reviewed = submissions.filter((submission: any) => submission.status === "reviewed");

  return (
    <div className="screen">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-kicker">Admin command</span>
          <h2>Keep every form, client, and audit trail moving in sync.</h2>
          <p>
            Published templates are live to caregivers, finished records are stored as signed PDFs, and the compliance trail stays visible in one place.
          </p>
        </div>
        <div className="dashboard-hero-panel">
          <div>
            <span>Ready to publish</span>
            <strong>{drafts.length} draft templates</strong>
          </div>
          <div>
            <span>Recent volume</span>
            <strong>{submissions.length} stored submissions</strong>
          </div>
          <div>
            <span>Client directory</span>
            <strong>{Store.clients.length} active clients</strong>
          </div>
        </div>
      </div>

      <div className="admin-stat-grid">
        <StatCard icon="layers" label="Published templates" value={published.length} />
        <StatCard icon="users" label="Team accounts" value={Store.getUsers().length} />
        <StatCard icon="fileText" label="Stored submissions" value={submissions.length} tone="soft-green" />
        <StatCard icon="checkCircle" label="Reviewed records" value={reviewed.length} tone="soft-mint" />
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h3>Recent activity</h3>
              <p>Newest audit events across sign-ins, template changes, and form filing.</p>
            </div>
          </div>
          <div className="admin-activity-list">
            {audit.length === 0 ? (
              <div className="admin-empty-inline">No recent activity. Audit events will appear here once users log in or perform actions.</div>
            ) : (
              audit.slice(0, 6).map((event: any) => (
                <div key={event.id} className="admin-activity-row">
                  <div className="admin-activity-icon">
                    <Icon n={event.action.includes("template") ? "layers" : event.action.includes("client") ? "users" : "fileText"} s={15} />
                  </div>
                  <div className="admin-activity-copy">
                    <strong>{event.target}</strong>
                    <span>
                      {event.actor} · {event.action.replaceAll("_", " ")}
                    </span>
                  </div>
                  <span className="admin-activity-role">{event.role}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h3>Publishing queue</h3>
              <p>Templates that still need review before they go live.</p>
            </div>
          </div>
          <div className="admin-queue-list">
            {drafts.length === 0 ? (
              <div className="admin-empty-inline">Everything currently imported is published.</div>
            ) : (
              drafts.map((template: any) => (
                <div className="admin-queue-row" key={template.key}>
                  <div>
                    <strong>{template.name}</strong>
                    <span>{template.fieldCount} editable fields · {template.category}</span>
                  </div>
                  <span className="ui-tag violet">Draft</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

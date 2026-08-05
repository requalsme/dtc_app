// The dev portal. Reached only through /dev-login (DevLoginPage), never
// through the ordinary sign-in — see DevProtectedRoute for the gate.
//
// One panel is real today: System Health, because it's built directly on the
// checklist SYSTEM-MAP.html already wrote out by hand — this just makes those
// same checks live instead of something you re-derive from memory. Deleted
// Items is real too, since it's the direct pair of the soft-delete this was
// built alongside. Templates and Users & Roles are scaffolded: they read and
// show real data, but editing a template's fields and changing someone's role
// from here rather than through updateUser directly is still to come.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
// @ts-ignore
import { DTCStore as Store } from "../../components/store.js";
// @ts-ignore
import { DTC } from "../../components/schemas.js";

type Page = "health" | "deleted" | "templates" | "users";

const homeByRole: Record<string, string> = {
  admin: "/admin",
  caregiver: "/caregiver",
  officeManager: "/office-manager",
  newHire: "/new-hire",
  client: "/client",
};

export default function DevPortal() {
  const { user, exitDevMode } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState<Page>("health");
  const [, force] = useState(0);

  useEffect(() => Store.subscribe(() => force((v: number) => v + 1)), []);

  const returnToRealPortal = () => {
    exitDevMode();
    navigate(homeByRole[user?.role || "caregiver"] || "/", { replace: true });
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-app, #f4f3f0)" }}>
      <aside style={{ width: 220, background: "#16241a", color: "#f0efe9", padding: "20px 14px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, padding: "0 6px" }}>
          <img src="/logo.png" alt="" style={{ width: 26, height: 26, borderRadius: 6 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Dare to Care</div>
            <div style={{ fontSize: 10, color: "#e6b552", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Dev portal</div>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {([
            ["health", "System health"],
            ["deleted", "Deleted items"],
            ["templates", "Templates"],
            ["users", "Users & roles"],
          ] as [Page, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              style={{
                textAlign: "left", padding: "9px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                background: page === key ? "#26332a" : "transparent",
                color: page === key ? "#fff" : "#c9d6cc", fontSize: 13.5, fontWeight: page === key ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 30, paddingTop: 14, borderTop: "1px solid #2a3f30" }}>
          <div style={{ fontSize: 11.5, color: "#9fc4ab", marginBottom: 8 }}>
            Signed in as {user?.name} — really a {user?.role}
          </div>
          <button
            onClick={returnToRealPortal}
            style={{ width: "100%", background: "#2a3f30", color: "#f0efe9", border: "none", borderRadius: 7, padding: "8px 10px", fontSize: 12.5, cursor: "pointer" }}
          >
            ← Return to my {user?.role} portal
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "28px 32px", overflow: "auto" }}>
        {page === "health" && <SystemHealth />}
        {page === "deleted" && <DeletedItems />}
        {page === "templates" && <Templates />}
        {page === "users" && <UsersRoles />}
      </main>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ---------- System health ---------- */

function StatusRow({ label, status, detail }: { label: string; status: "ok" | "warn" | "stop" | "manual"; detail: string }) {
  const color = { ok: "#188045", warn: "#c98a1a", stop: "#c23b3b", manual: "#8a8a8a" }[status];
  const text = { ok: "OK", warn: "Needs attention", stop: "Problem", manual: "Check manually" }[status];
  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{label}</td>
      <td><span style={{ color, fontWeight: 700, fontSize: 12.5 }}>{text}</span></td>
      <td style={{ color: "var(--text-muted, #666)", fontSize: 13 }}>{detail}</td>
    </tr>
  );
}

function SystemHealth() {
  const submissions = Store.getSubmissions ? Store.getSubmissions() : [];
  const certificates = Store.getCertificates ? Store.getCertificates() : [];
  const inbound = Store.getInbound ? Store.getInbound() : [];
  const users = Store.getUsers ? Store.getUsers() : [];

  const pendingPdfs = submissions.filter((s: any) => s.pdfPending).length;
  const unmatchedCerts = certificates.filter((c: any) => {
    const linked = users.find((u: any) => u.id === c.linkedUserId)
      || users.find((u: any) => c.email && (u.email || "").toLowerCase() === String(c.email).toLowerCase());
    return !linked;
  }).length;
  const inboundOpen = inbound.filter((i: any) => i.status !== "resolved" && i.status !== "dismissed").length;
  const moduleCount = Store.courseModuleCount ? Store.courseModuleCount() : 0;

  return (
    <Section title="System health" sub="The same checks from the runbook, live instead of remembered.">
      <div className="ds-panel">
        <table className="ds-table">
          <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            <StatusRow
              label="Forms filing to PDF"
              status={pendingPdfs === 0 ? "ok" : "warn"}
              detail={pendingPdfs === 0 ? "Nothing stuck." : `${pendingPdfs} submission(s) have a pending PDF — a filing or storage-permission failure.`}
            />
            <StatusRow
              label="Certificates matched to a person"
              status={unmatchedCerts === 0 ? "ok" : "warn"}
              detail={unmatchedCerts === 0 ? "All certificates are matched." : `${unmatchedCerts} unmatched — see Admin → Certificates.`}
            />
            <StatusRow
              label="Inbound review queue"
              status={inboundOpen === 0 ? "ok" : "warn"}
              detail={inboundOpen === 0 ? "Nothing waiting." : `${inboundOpen} item(s) waiting on a human match.`}
            />
            <StatusRow
              label="Course modules tracked"
              status={moduleCount > 0 ? "ok" : "manual"}
              detail={moduleCount > 0 ? `${moduleCount} module(s) — this is the number the checklist requires, not a fixed six.` : "No certificates recorded yet, so nothing to count."}
            />
            <StatusRow
              label="Firebase Storage rules deployed"
              status="manual"
              detail="Not readable from the browser. Firebase console → Storage → Rules. Run DEPLOY-RULES.bat if it still shows the console defaults."
            />
            <StatusRow
              label="Anonymous auth enabled"
              status="manual"
              detail="Certificates from the course site depend on this and fail silently without it. Firebase console → Authentication → Sign-in method → Anonymous."
            />
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ---------- Deleted items ---------- */

function DeletedItems() {
  const [, force] = useState(0);
  const deleted = Store.getDeletedSubmissions ? Store.getDeletedSubmissions() : [];

  const restore = async (id: string) => {
    await Store.restoreSubmission(id);
    force((v) => v + 1);
  };

  return (
    <Section title="Deleted items" sub="Nothing here was erased — every row can be put back.">
      <div className="ds-panel">
        {deleted.length === 0 ? (
          <p style={{ color: "var(--text-muted, #666)" }}>Nothing has been deleted.</p>
        ) : (
          <table className="ds-table">
            <thead><tr><th>Form</th><th>Deleted by</th><th>When</th><th>Reason</th><th></th></tr></thead>
            <tbody>
              {deleted.map((s: any) => (
                <tr key={s.id}>
                  <td>{s.templateName || s.schemaKey}</td>
                  <td>{s.deletedBy || "—"}</td>
                  <td>{s.deletedAt ? new Date(s.deletedAt).toLocaleString() : "—"}</td>
                  <td>{s.deleteReason || "—"}</td>
                  <td><button className="dbtn" onClick={() => restore(s.id)}>Restore</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

/* ---------- Templates (scaffold — read-only for now) ---------- */

function Templates() {
  const rows = Object.entries(DTC.schemas || {});

  return (
    <Section title="Templates" sub="The form definitions every submission is built from. Editing here is next — for now this is a real list, not a mock.">
      <div className="ds-panel">
        <table className="ds-table">
          <thead><tr><th>Form</th><th>Subject</th><th>Fields</th></tr></thead>
          <tbody>
            {rows.map(([key, schema]: any) => {
              const fieldCount = (schema.sections || []).reduce((n: number, s: any) => n + (s.fields || []).length, 0);
              return (
                <tr key={key}>
                  <td>{schema.name || key}</td>
                  <td>{schema.subject}</td>
                  <td>{fieldCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ---------- Users & roles ---------- */

function UsersRoles() {
  const [, force] = useState(0);
  const users = Store.getUsers ? Store.getUsers() : [];

  const setRole = async (id: string, role: string) => {
    await Store.updateUser(id, { role });
    force((v) => v + 1);
  };

  const toggleDev = async (id: string, current: boolean) => {
    await Store.updateUser(id, { devAccess: !current });
    force((v) => v + 1);
  };

  return (
    <Section title="Users & roles" sub="Change someone's real job here, or grant/revoke dev access. Both are logged.">
      <div className="ds-panel">
        <table className="ds-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Dev access</th></tr></thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)}>
                    <option value="caregiver">Caregiver</option>
                    <option value="officeManager">Office Manager</option>
                    <option value="admin">Admin</option>
                    <option value="newHire">New Hire</option>
                    <option value="client">Client</option>
                  </select>
                </td>
                <td>
                  <button className="dbtn" onClick={() => toggleDev(u.id, !!u.devAccess)}>
                    {u.devAccess ? "Revoke" : "Grant"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

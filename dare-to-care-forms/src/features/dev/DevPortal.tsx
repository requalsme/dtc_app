// The dev portal. Reached only through /dev-login (DevLoginPage), never
// through the ordinary sign-in — see DevProtectedRoute for the gate.
//
// One panel is real today: System Health, because it's built directly on the
// checklist SYSTEM-MAP.html already wrote out by hand — this just makes those
// same checks live instead of something you re-derive from memory. Deleted
// Items is real too, since it's the direct pair of the soft-delete this was
// built alongside. Templates is read-only; editing a form's fields happens in
// the admin form builder rather than here.
//
// The rail stays dark and gold-marked on purpose. This portal can permanently
// destroy records and hand out its own access, so it should never be mistaken
// at a glance for the ordinary console.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
// @ts-ignore
import { DTCStore as Store } from "../../components/store.js";
// @ts-ignore
import { DTC } from "../../components/schemas.js";
import {
  Icon, Button, Stamp, Select, Input, Textarea,
  RecordRow, EmptyState, Text, Dialog,
  // @ts-ignore - design system is untyped JSX
} from "../../design/index.js";

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
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-app)" }}>
      <aside style={{
        width: 232, background: "var(--surface-inverse)", color: "var(--text-on-inverse)",
        padding: "22px 14px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 24, padding: "0 6px" }}>
          <img src="/logo.png" alt="" style={{ width: 26, height: 26, borderRadius: "var(--radius-sm)" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-on-inverse)" }}>Dare to Care</div>
            <div style={{
              fontFamily: "var(--font-label)", fontSize: 10, color: "#e6b552",
              fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
            }}>Dev portal</div>
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
                textAlign: "left", padding: "10px 11px", borderRadius: "var(--radius-control)",
                border: "none", cursor: "pointer", font: "inherit",
                background: page === key ? "rgba(255,255,255,.09)" : "transparent",
                color: page === key ? "var(--text-on-inverse)" : "rgba(241,246,241,.62)",
                fontSize: 13.5, fontWeight: page === key ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 30, paddingTop: 14, borderTop: "1px solid var(--border-inverse)" }}>
          <div style={{ fontSize: 11.5, color: "rgba(241,246,241,.58)", marginBottom: 9, lineHeight: 1.5 }}>
            Signed in as {user?.name} — really a {user?.role}
          </div>
          <button
            onClick={returnToRealPortal}
            style={{
              width: "100%", background: "rgba(255,255,255,.08)", color: "var(--text-on-inverse)",
              border: "1px solid var(--border-inverse-strong)", borderRadius: "var(--radius-control)",
              padding: "9px 10px", fontSize: 12.5, cursor: "pointer", font: "inherit",
            }}
          >
            ← Return to my {user?.role} portal
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "40px 44px", overflow: "auto" }}>
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
      <header style={{ marginBottom: 28 }}>
        <h1 style={{
          margin: 0, fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1.15,
          letterSpacing: "-0.02em", fontWeight: 500, color: "var(--text-brand)",
        }}>{title}</h1>
        {sub && (
          <p style={{ margin: "12px 0 0", maxWidth: "62ch", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-muted)" }}>
            {sub}
          </p>
        )}
      </header>
      {children}
    </div>
  );
}

/* ---------- System health ---------- */

const HEALTH_TONE: Record<string, string> = { ok: "success", warn: "warning", stop: "error", manual: "neutral" };
const HEALTH_WORD: Record<string, string> = { ok: "OK", warn: "Needs attention", stop: "Problem", manual: "Check by hand" };

function StatusRow({ label, status, detail }: { label: string; status: "ok" | "warn" | "stop" | "manual"; detail: string }) {
  return (
    <RecordRow
      icon={<Icon name={status === "ok" ? "checkCircle" : status === "manual" ? "eye" : "alert"} size={17} />}
      title={label}
      subtitle={detail}
      stamp={<Stamp tone={HEALTH_TONE[status]}>{HEALTH_WORD[status]}</Stamp>}
      accentEdge={status === "warn" || status === "stop"}
    />
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 900 }}>
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
          label="Storage policies applied"
          status="manual"
          detail="Not readable from the browser. Supabase dashboard → SQL editor: run supabase/storage.sql. These check the caller's role against the users table, which the old Firebase rules could not do."
        />
        <StatusRow
          label="Anonymous sign-ins enabled"
          status="manual"
          detail="Certificates from the course site depend on this and fail silently without it. Supabase dashboard → Authentication → Providers → Anonymous sign-ins."
        />
        <StatusRow
          label="Text-message sign-in"
          status="manual"
          detail="Linking a phone needs an SMS provider on the project. Supabase dashboard → Authentication → Sign In / Providers → Phone. Without one, everybody who tries gets 'Unable to get SMS provider'."
        />
      </div>
    </Section>
  );
}

/* ---------- Deleted items ---------- */

function DeletedItems() {
  const [, force] = useState(0);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  // Used to live behind window.prompt() after the DELETE confirmation — a
  // native, synchronous dialog that blocks the page's JS thread until
  // dismissed. Folded into this same dialog instead: one flow, no blocking
  // browser-chrome dialog to fight with (automation included).
  const [hardDeleteReason, setHardDeleteReason] = useState("");
  const deleted = Store.getDeletedSubmissions ? Store.getDeletedSubmissions() : [];

  const restore = async (id: string) => {
    await Store.restoreSubmission(id);
    force((v) => v + 1);
  };

  const openConfirm = (id: string) => { setConfirming(id); setTyped(""); setHardDeleteReason(""); };
  const closeConfirm = () => { setConfirming(null); setTyped(""); setHardDeleteReason(""); };

  const confirmHardDelete = async () => {
    if (!confirming) return;
    await Store.hardDeleteSubmission(confirming, hardDeleteReason);
    closeConfirm();
    force((v) => v + 1);
  };

  const target = deleted.find((s: any) => s.id === confirming);

  return (
    <Section title="Deleted items" sub="Soft-deleted rows can be restored. Permanent delete is one step further and does not come back.">
      {deleted.length === 0 ? (
        <EmptyState title="Nothing deleted" description="Soft-deleted submissions appear here, ready to restore." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 900 }}>
          {deleted.map((s: any) => (
            <RecordRow
              key={s.id}
              icon={<Icon name="trash" size={17} />}
              title={s.templateName || s.schemaKey}
              subtitle={[
                s.deletedBy ? `Deleted by ${s.deletedBy}` : null,
                s.deletedAt ? new Date(s.deletedAt).toLocaleString() : null,
                s.deleteReason ? `“${s.deleteReason}”` : null,
              ].filter(Boolean).join(" · ")}
              stamp={<Stamp tone="neutral">Deleted</Stamp>}
              actions={
                <div style={{ display: "flex", gap: 6 }}>
                  <Button size="sm" variant="outline" onClick={() => restore(s.id)}>Restore</Button>
                  <Button size="sm" variant="danger" onClick={() => openConfirm(s.id)}>Delete for good</Button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {/* The only irreversible action in the product, so it asks for a typed
          confirmation AND a reason — the reason is what the audit log keeps
          once the document itself is gone. */}
      <Dialog
        open={!!confirming && !!target}
        title="This cannot be undone"
        icon={<Icon name="alert" size={20} />}
        onClose={closeConfirm}
        width={520}
        footer={
          <>
            <Button variant="ghost" onClick={closeConfirm}>Cancel</Button>
            <Button variant="solid_danger" disabled={typed !== "DELETE"} onClick={confirmHardDelete}>
              Permanently delete
            </Button>
          </>
        }
      >
        {target && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Text role="body" color="secondary" style={{ fontSize: 13.5, lineHeight: 1.65 }}>
              You are about to permanently delete <strong>{target.templateName || target.schemaKey}</strong>
              {target.clientName || target.caregiverName ? <> for <strong>{target.clientName || target.caregiverName}</strong></> : null}.
              Unlike everything else in this system, this record will not be recoverable and will not
              appear anywhere again — not even here. A snapshot goes into the audit log, but the
              document itself is gone.
            </Text>
            <Textarea
              label="Why is this being permanently deleted?"
              rows={2}
              placeholder="Goes in the audit log."
              value={hardDeleteReason}
              onChange={(e: any) => setHardDeleteReason(e.target.value)}
            />
            <Input
              label="Type DELETE to confirm"
              value={typed}
              onChange={(e: any) => setTyped(e.target.value)}
              autoFocus
            />
          </div>
        )}
      </Dialog>
    </Section>
  );
}

/* ---------- Templates (read-only) ---------- */

function Templates() {
  const rows = Object.entries(DTC.schemas || {});

  return (
    <Section title="Templates" sub="The form definitions every submission is built from. Read-only here — editing happens in the admin form builder.">
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 900 }}>
        {rows.map(([key, schema]: any) => {
          const fieldCount = (schema.sections || []).reduce((n: number, s: any) => n + (s.fields || []).length, 0);
          return (
            <RecordRow
              key={key}
              icon={<Icon name="layers" size={17} />}
              title={schema.name || key}
              subtitle={`${schema.subject} · ${fieldCount} ${fieldCount === 1 ? "field" : "fields"}`}
              meta={key}
            />
          );
        })}
      </div>
    </Section>
  );
}

/* ---------- Users & roles ---------- */

const DEV_ROLES = [
  { value: "caregiver", label: "Caregiver" },
  { value: "officeManager", label: "Office manager" },
  { value: "admin", label: "Admin" },
  { value: "newHire", label: "New hire" },
  { value: "client", label: "Client" },
];

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
    <Section
      title="Users & roles"
      sub="Change someone's real job here, or grant and revoke dev access. Both are logged, and the database rejects a self-write that grants dev access."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 940 }}>
        {users.map((u: any) => (
          <RecordRow
            key={u.id}
            icon={<Icon name="users" size={17} />}
            title={u.name}
            subtitle={u.email}
            stamp={u.devAccess ? <Stamp tone="info">Dev access</Stamp> : null}
            actions={
              <div style={{ display: "flex", gap: 8, alignItems: "center" }} onClick={(e: any) => e.stopPropagation()}>
                <div style={{ width: 170 }}>
                  <Select value={u.role} onChange={(e: any) => setRole(u.id, e.target.value)} options={DEV_ROLES} />
                </div>
                <Button
                  size="sm"
                  variant={u.devAccess ? "danger" : "outline"}
                  onClick={() => toggleDev(u.id, !!u.devAccess)}
                >
                  {u.devAccess ? "Revoke" : "Grant"}
                </Button>
              </div>
            }
          />
        ))}
      </div>
    </Section>
  );
}

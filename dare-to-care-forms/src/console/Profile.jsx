// Your own record — who the app thinks you are, and what is waiting on you.
//
// WHY THIS EXISTS
// Everyone in this app could see the people and paperwork they administer, and
// nobody could see themselves. The only thing behind the profile block in the
// rail was "sign out", so questions as ordinary as "which email is this account
// under", "is my phone linked", or "what has been assigned to me" had no answer
// anywhere in the product.
//
// It is deliberately one screen for every role rather than five. What changes
// between a caregiver and an office manager is which sections have anything in
// them, and an empty section says so plainly instead of being hidden — "no
// forms are waiting on you" is a useful thing to be told.

import React from "react";
import {
  Icon, Button, Stamp, MonoLabel, Panel, RecordRow, EmptyState, Chip, Text,
} from "../design/index.js";
import { SheetHeader } from "./Chrome.jsx";
import { useStore } from "./useStore.js";

const ROLE_LABEL = {
  admin: "Administrator",
  officeManager: "Office manager",
  caregiver: "Caregiver",
  newHire: "New hire",
  client: "Client",
};

const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/** A labelled fact, with a consistent place for the value to sit. */
function Fact({ label, value, muted, action }) {
  return (
    <div style={{
      display: "flex", gap: 14, alignItems: "baseline",
      padding: "11px 0", borderTop: "1px solid var(--border-hair)",
    }}>
      <span style={{ flex: "0 0 38%", fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{
        flex: 1, fontSize: 13.5, wordBreak: "break-word",
        color: muted ? "var(--text-quiet)" : "var(--text-body)",
        fontWeight: muted ? 400 : 600,
      }}>
        {value}
      </span>
      {action}
    </div>
  );
}

/**
 * @param {object}   user        the signed-in person
 * @param {Function} onLinkPhone opens the link-phone dialog in the shell
 */
export function ProfileScreen({ user, onLinkPhone, onNavigate }) {
  const Store = useStore();
  if (!user) return <EmptyState title="Not signed in" description="Sign in to see your profile." />;

  const submissions = Store.getSubmissions ? Store.getSubmissions() : [];
  const tasks = Store.getTasks ? Store.getTasks() : [];
  const certificates = Store.certificatesForUser ? Store.certificatesForUser(user) : [];

  // Work that is genuinely this person's, not everything they can see. An
  // admin can read every submission in the agency; that does not make them all
  // theirs, and listing them here would bury the handful that are.
  const mine = submissions.filter((s) => s.caregiverId === user.id);
  const needsCorrection = mine.filter((s) => s.status === "needsCorrection");
  const myTasks = tasks.filter(
    (t) => t.assignedTo === user.id || t.assigneeId === user.id || t.userId === user.id,
  );
  const openTasks = myTasks.filter((t) => t.status !== "done" && t.status !== "complete");

  const phoneLinked = !!user.phone;

  return (
    <>
      <SheetHeader
        eyebrow="Your account"
        title={user.name}
        lead={`${ROLE_LABEL[user.role] || user.role} · everything this account is and everything waiting on it.`}
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
        <Stamp tone="brand">{ROLE_LABEL[user.role] || user.role}</Stamp>
        {user.status && user.status !== "active" && <Stamp tone="warning">{user.status}</Stamp>}
        {user.devAccess && <Stamp tone="info">Owner access</Stamp>}
        {needsCorrection.length > 0 && (
          <Chip icon={<Icon name="alert" size={14} />}>
            {needsCorrection.length} needing correction
          </Chip>
        )}
      </div>

      <div className="split" style={{ alignItems: "start" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div>
            <MonoLabel rule style={{ marginBottom: 6 }}>Waiting on you</MonoLabel>
            {needsCorrection.length === 0 && openTasks.length === 0 ? (
              <div style={{ padding: "16px 0", fontSize: 13.5, color: "var(--text-quiet)" }}>
                Nothing is waiting on you right now.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {needsCorrection.map((s) => (
                  <RecordRow
                    key={s.id}
                    icon={<Icon name="alert" size={17} />}
                    title={s.templateName || s.templateKey || "Form"}
                    subtitle={[s.clientName, "sent back for correction"].filter(Boolean).join(" · ")}
                    meta={fmtDate(s.updatedAt || s.createdAt) || ""}
                    stamp={<Stamp tone="warning">Correct</Stamp>}
                    accentEdge
                  />
                ))}
                {openTasks.map((t) => (
                  <RecordRow
                    key={t.id}
                    icon={<Icon name="checkCircle" size={17} />}
                    title={t.title || t.label || "Task"}
                    subtitle={t.description || t.note || ""}
                    meta={fmtDate(t.dueAt || t.createdAt) || ""}
                    stamp={<Stamp tone="neutral">Task</Stamp>}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <MonoLabel rule count={mine.length} style={{ marginBottom: 12 }}>Forms you have filed</MonoLabel>
            {mine.length === 0 ? (
              <div style={{ fontSize: 13.5, color: "var(--text-quiet)" }}>
                You haven't filed anything yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {mine.slice(0, 8).map((s) => (
                  <RecordRow
                    key={s.id}
                    icon={<Icon name="file" size={17} />}
                    title={s.templateName || s.templateKey || "Form"}
                    subtitle={s.clientName || ""}
                    meta={fmtDate(s.createdAt) || ""}
                    stamp={<Stamp tone={s.status === "approved" ? "success" : "neutral"}>{s.status || "Filed"}</Stamp>}
                  />
                ))}
                {mine.length > 8 && (
                  <div style={{ fontSize: 12.5, color: "var(--text-quiet)", paddingTop: 4 }}>
                    and {mine.length - 8} more.
                  </div>
                )}
              </div>
            )}
          </div>

          {certificates.length > 0 && (
            <div>
              <MonoLabel rule count={certificates.length} style={{ marginBottom: 12 }}>Training completed</MonoLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {certificates.map((c) => (
                  <RecordRow
                    key={c.id}
                    icon={<Icon name="award" size={17} />}
                    title={c.courseName || c.course || "Course"}
                    subtitle={c.score ? `Score ${c.score}` : ""}
                    meta={fmtDate(c.completedAt || c.issuedAt) || ""}
                    stamp={<Stamp tone="success">Complete</Stamp>}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel label="Account">
            <Fact label="Name" value={user.name} />
            <Fact label="Email" value={user.email || "—"} muted={!user.email} />
            <Fact
              label="Phone"
              value={phoneLinked ? user.phone : "Not linked"}
              muted={!phoneLinked}
              action={
                onLinkPhone && (
                  <Button size="sm" variant="ghost" onClick={onLinkPhone}>
                    {phoneLinked ? "Change" : "Link"}
                  </Button>
                )
              }
            />
            <Fact label="Role" value={ROLE_LABEL[user.role] || user.role} />
            {user.createdAt && <Fact label="Account created" value={fmtDate(user.createdAt)} />}
            {user.lastLoginAt && <Fact label="Last signed in" value={fmtDate(user.lastLoginAt)} />}
          </Panel>

          <Panel label="How you sign in">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                <span style={{ color: "var(--status-success)" }}><Icon name="checkCircle" size={16} /></span>
                <span style={{ color: "var(--text-body)" }}>Email and password</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                <span style={{ color: phoneLinked ? "var(--status-success)" : "var(--text-quiet)" }}>
                  <Icon name={phoneLinked ? "checkCircle" : "alert"} size={16} />
                </span>
                <span style={{ color: phoneLinked ? "var(--text-body)" : "var(--text-secondary)" }}>
                  Text message code {phoneLinked ? "" : "— not set up"}
                </span>
              </div>
            </div>
            <Text role="body" color="quiet" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 14, display: "block" }}>
              Linking a phone lets you sign in with a texted code instead of a password.
            </Text>
          </Panel>
        </aside>
      </div>
    </>
  );
}

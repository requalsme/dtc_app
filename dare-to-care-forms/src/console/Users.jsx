// The team screen — who has an account, and what they can reach.
//
// The screen this replaces listed everyone in one flat run with the create form
// wedged alongside, so a nine-person agency and a ninety-person one would read
// the same. People are grouped by role here instead, because "who are my office
// staff" and "who are my caregivers" are different questions and the roster is
// how you answer both.
//
// Creating an account is a dialog rather than a permanent panel. It is a
// deliberate, occasional act — it needs the screen's attention while it is
// happening and none of it the rest of the time.
//
// Every behaviour of the old screen is carried over: create with a generated
// temporary password, the copy-the-password confirmation, edit name/role/
// status, and send a password reset.

import React from "react";
import {
  Icon, Button, IconButton, Stamp, MonoLabel, Avatar, Input, Select,
  Panel, Dialog, EmptyState, Chip,
} from "../design/index.js";
import { SheetHeader, useAreaLabel } from "./Chrome.jsx";
import { useStore } from "./useStore.js";

// Ordered by reach, not alphabetically: the people who can change the most
// appear first, so an access review reads top-down.
const ROLE_ORDER = ["admin", "officeManager", "caregiver", "newHire", "client"];

const ROLE_LABEL = {
  admin: "Administrators",
  officeManager: "Office managers",
  caregiver: "Caregivers",
  newHire: "New hires",
  client: "Clients",
};

const ROLE_SINGULAR = {
  admin: "Administrator",
  officeManager: "Office manager",
  caregiver: "Caregiver",
  newHire: "New hire",
  client: "Client",
};

// Avatar's role vocabulary differs from the app's, so it is mapped rather than
// passed straight through — an unknown value would silently drop the tint.
const AVATAR_ROLE = {
  admin: "admin",
  officeManager: "office",
  caregiver: "caregiver",
  newHire: "new-hire",
  client: "client",
};

const ROLE_OPTIONS = ROLE_ORDER.map((value) => ({ value, label: ROLE_SINGULAR[value] }));

/** A memorable-but-strong temporary password. Words plus digits beats a random
 *  string here because someone has to read it down a phone line. */
function generatePassword() {
  const words = ["harbor", "willow", "cedar", "meadow", "lantern", "compass", "thistle", "juniper"];
  const w = () => words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(Math.random() * 90 + 10);
  return w() + "-" + w() + "-" + n;
}

function PersonRow({ person, onEdit, onReset, busyReset }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "13px 16px",
        borderRadius: "var(--radius-panel)",
        background: hover ? "var(--surface-card)" : "transparent",
        border: "1px solid " + (hover ? "var(--border-subtle)" : "transparent"),
        transition: "background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)",
      }}
    >
      <Avatar name={person.name} size={34} role={AVATAR_ROLE[person.role]} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.008em" }}>{person.name || "—"}</span>
          {person.devAccess && <Stamp tone="brand" leaf={false}>Dev</Stamp>}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {person.email}
        </div>
      </div>

      {person.mustChangePassword && (
        <Chip icon={<Icon name="lock" size={13} />}>Temporary password</Chip>
      )}
      {person.status && person.status !== "active" && (
        <Stamp tone="neutral">{person.status}</Stamp>
      )}

      {/* Actions appear on hover but stay in the layout, so rows never reflow. */}
      <div style={{ display: "flex", gap: 6, opacity: hover ? 1 : 0, transition: "opacity var(--duration-fast) var(--ease-standard)" }}>
        <IconButton
          icon={<Icon name="refresh" size={15} />}
          label={"Send " + (person.name || "this user") + " a password reset"}
          size="sm"
          disabled={busyReset}
          onClick={() => onReset(person)}
        />
        <IconButton
          icon={<Icon name="edit" size={15} />}
          label={"Edit " + (person.name || "this user")}
          size="sm"
          onClick={() => onEdit(person)}
        />
      </div>
    </div>
  );
}

export function UsersScreen({ onToast }) {
  const Store = useStore();
  const area = useAreaLabel();

  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");

  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", role: "caregiver", password: "" });
  const [createBusy, setCreateBusy] = React.useState(false);
  const [createError, setCreateError] = React.useState("");
  const [created, setCreated] = React.useState(null);

  const [editing, setEditing] = React.useState(null);
  const [editBusy, setEditBusy] = React.useState(false);
  const [resetBusy, setResetBusy] = React.useState(false);

  const everyone = Store.getUsers();

  const filtered = everyone.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (!search.trim()) return true;
    return [u.name, u.email].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase());
  });

  const grouped = ROLE_ORDER
    .map((role) => ({ role, people: filtered.filter((u) => u.role === role) }))
    .filter((g) => g.people.length > 0);

  const openCreate = () => {
    setForm({ name: "", email: "", role: "caregiver", password: generatePassword() });
    setCreateError("");
    setCreating(true);
  };

  const doCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) { setCreateError("Name and email are both needed."); return; }
    if (form.password.length < 10) { setCreateError("The temporary password needs at least 10 characters."); return; }
    setCreateBusy(true);
    try {
      const person = await Store.createUser({ ...form, name: form.name.trim(), email: form.email.trim() });
      setCreating(false);
      setCreated({ ...person, tempPassword: form.password });
    } catch (err) {
      setCreateError(err.message || "That account couldn't be created.");
    } finally {
      setCreateBusy(false);
    }
  };

  const doSaveEdit = async () => {
    setEditBusy(true);
    try {
      await Store.updateUser(editing.id, {
        name: editing.name,
        role: editing.role,
        status: editing.status,
      });
      setEditing(null);
      onToast && onToast("Saved");
    } catch (err) {
      onToast && onToast(err.message || "That didn't save");
    } finally {
      setEditBusy(false);
    }
  };

  const doReset = async (person) => {
    setResetBusy(true);
    try {
      await Store.sendPasswordReset(person.email);
      onToast && onToast("Reset link sent to " + person.email);
    } catch (err) {
      onToast && onToast(err.message || "Couldn't send that reset");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <>
      <SheetHeader
        eyebrow={area + " / Team"}
        title="Team"
        lead="Everyone with an account, grouped by what they can reach. Accounts are created with a temporary password that the person replaces when they first sign in."
        actions={
          <Button iconLeft={<Icon name="plus" size={16} />} onClick={openCreate}>
            Add account
          </Button>
        }
      />

      <div style={{ display: "flex", gap: 12, margin: "0 0 30px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 300 }}>
          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            iconLeft={<Icon name="search" size={17} />}
          />
        </div>
        <div style={{ width: 200 }}>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[{ value: "all", label: "Every role" }, ...ROLE_OPTIONS]}
          />
        </div>
        <span style={{ flex: 1 }} />
        <MonoLabel count={filtered.length}>
          {filtered.length === everyone.length ? "Accounts" : "Matching"}
        </MonoLabel>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          title={everyone.length === 0 ? "No accounts yet" : "Nobody matches that"}
          description={everyone.length === 0
            ? "Add the first account to get started."
            : "Try part of a name, or clear the role filter."}
          action={everyone.length === 0 ? <Button onClick={openCreate}>Add account</Button> : undefined}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 30, maxWidth: 780 }}>
          {grouped.map(({ role, people }) => (
            <section key={role}>
              <MonoLabel rule count={people.length} style={{ marginBottom: 10 }}>
                {ROLE_LABEL[role] || role}
              </MonoLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {people.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    onEdit={setEditing}
                    onReset={doReset}
                    busyReset={resetBusy}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Create ─────────────────────────────────────────────────────────── */}
      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Add an account"
        description="They'll be asked to choose their own password the first time they sign in."
        icon={<Icon name="users" size={20} />}
        width={460}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={doCreate} disabled={createBusy}>
              {createBusy ? "Creating…" : "Create account"}
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          <Input
            label="Full name"
            value={form.name}
            onChange={(e) => { setForm({ ...form, name: e.target.value }); setCreateError(""); }}
            placeholder="Jane Smith"
            autoComplete="off"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => { setForm({ ...form, email: e.target.value }); setCreateError(""); }}
            placeholder="jane@daretocarehomecare.com"
            autoComplete="off"
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={ROLE_OPTIONS}
            hint={form.role === "admin" ? "Administrators can change templates and create accounts." : undefined}
          />
          <Input
            label="Temporary password"
            value={form.password}
            onChange={(e) => { setForm({ ...form, password: e.target.value }); setCreateError(""); }}
            error={createError || undefined}
            hint={createError ? undefined : "Read this out to them — they replace it on first sign-in"}
            // Without this the browser fills in the ADMIN's own saved password
            // and offers it under "share with user".
            autoComplete="new-password"
            name="dtc-new-account-password"
            iconRight={
              <button
                type="button"
                onClick={() => setForm({ ...form, password: generatePassword() })}
                title="Generate another"
                style={{ border: 0, background: "none", cursor: "pointer", color: "var(--text-quiet)", display: "flex", padding: 0 }}
              >
                <Icon name="refresh" size={16} />
              </button>
            }
          />
        </div>
      </Dialog>

      {/* ── Created ────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!created}
        onClose={() => setCreated(null)}
        title="Account created"
        icon={<Icon name="check" size={20} />}
        width={440}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(created.tempPassword);
                onToast && onToast("Password copied");
              }}
            >
              Copy password
            </Button>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </div>
        }
      >
        {created && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center" }}>
            <Avatar name={created.name} size={52} role={AVATAR_ROLE[created.role]} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{created.name}</div>
              <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 3 }}>
                {created.email + " · " + (ROLE_SINGULAR[created.role] || created.role)}
              </div>
            </div>
            <Panel tone="accent" padding={16} style={{ width: "100%" }}>
              <MonoLabel style={{ justifyContent: "center" }}>Temporary password</MonoLabel>
              {/* DM Mono is right here and almost nowhere else: this is a literal
                  machine string that has to be read back character by character. */}
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 19, fontWeight: 500,
                letterSpacing: "0.04em", color: "var(--green-900)", marginTop: 8, wordBreak: "break-all",
              }}>{created.tempPassword}</div>
            </Panel>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: "34ch" }}>
              Give this to {(created.name || "them").split(" ")[0]} directly. They'll be asked to choose their own the first time they sign in.
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Edit ───────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? "Edit " + (editing.name || "account") : "Edit"}
        icon={<Icon name="edit" size={20} />}
        width={440}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={doSaveEdit} disabled={editBusy}>{editBusy ? "Saving…" : "Save"}</Button>
          </div>
        }
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <Input
              label="Full name"
              value={editing.name || ""}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <Select
              label="Role"
              value={editing.role}
              onChange={(e) => setEditing({ ...editing, role: e.target.value })}
              options={ROLE_OPTIONS}
            />
            <Select
              label="Status"
              value={editing.status || "active"}
              onChange={(e) => setEditing({ ...editing, status: e.target.value })}
              options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
              hint="Inactive keeps their filed paperwork and stops them signing in."
            />
            <div style={{ fontSize: 12.5, color: "var(--text-quiet)", lineHeight: 1.5 }}>
              Email can't be changed here — it is the account's identity. Dev access is
              granted by hand and never through this screen.
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

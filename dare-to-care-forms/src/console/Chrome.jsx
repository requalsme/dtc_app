// The console shell: navigation rail and sheet header.
//
// Ported from the design kit's office_manager UI kit. Two things changed in the
// move, both because the kit is a static prototype and this is the real app:
// navigation goes through react-router rather than a `route` string in local
// state, and the person shown at the foot of the rail is the signed-in user
// rather than the kit's placeholder.

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Icon, Logo, Avatar } from "../design/index.js";

const ROLE_LABEL = {
  admin: "Administrator",
  officeManager: "Office manager",
  caregiver: "Caregiver",
  newHire: "New hire",
  client: "Client",
};

function RailLabel({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px", marginBottom: 10 }}>
      <span style={{
        fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: 11,
        fontWeight: 600, letterSpacing: "0.12em", color: "rgba(241,246,241,.72)",
      }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "var(--border-inverse)" }} />
    </div>
  );
}

function RailItem({ to, icon, label, badge, end }) {
  const [hover, setHover] = React.useState(false);
  return (
    <NavLink
      to={to}
      end={end}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={({ isActive }) => ({
        position: "relative", display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: "0 20px", height: 42, border: 0, cursor: "pointer", textAlign: "left",
        textDecoration: "none",
        background: isActive ? "rgba(255,255,255,.07)" : hover ? "rgba(255,255,255,.035)" : "transparent",
        color: isActive ? "var(--text-on-inverse)" : "rgba(241,246,241,.74)",
        fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: isActive ? 600 : 450,
        letterSpacing: "-0.005em",
        transition: "background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)",
      })}
    >
      {({ isActive }) => (
        <>
          {isActive && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "var(--green-300)" }} />}
          <span style={{ color: isActive ? "var(--green-300)" : "rgba(241,246,241,.45)", display: "flex" }}>
            <Icon name={icon} size={17} />
          </span>
          <span style={{ flex: 1 }}>{label}</span>
          {badge ? (
            <span style={{
              fontFamily: "var(--font-figure)", fontSize: 13, fontWeight: 500,
              fontVariantNumeric: "tabular-nums", color: "var(--green-300)",
            }}>{badge}</span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

/**
 * @param {{ groups: Array<{label: string, items: Array<object>}>, user: object }} props
 */
export function Rail({ groups, user }) {
  return (
    <aside className="rail">
      <div style={{ padding: "26px 20px 22px" }}>
        <Logo onDark width={204} basePath="/brand" />
      </div>
      <div style={{ height: 1, background: "var(--border-inverse)", margin: "0 0 20px" }} />

      {groups.map((group, i) => (
        <React.Fragment key={group.label}>
          {i > 0 && <div style={{ height: 22 }} />}
          <RailLabel>{group.label}</RailLabel>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            {group.items.map((item) => <RailItem key={item.to} {...item} />)}
          </nav>
        </React.Fragment>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{ padding: "18px 20px 22px", borderTop: "1px solid var(--border-inverse)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Avatar
            name={user?.name || "—"}
            size={34}
            style={{ background: "rgba(255,255,255,.08)", color: "var(--green-300)", border: "1px solid var(--border-inverse-strong)" }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "var(--text-on-inverse)", fontSize: 13.5, fontWeight: 600 }}>{user?.name || "Signed in"}</div>
            <div style={{ fontSize: 12.5, color: "rgba(241,246,241,.58)", marginTop: 3 }}>
              {ROLE_LABEL[user?.role] || user?.role || ""}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * The section name for a sheet's eyebrow, taken from the route.
 *
 * These screens are shared between the administrator and office-manager
 * consoles, so a hardcoded "Office manager" was appearing above an
 * administrator's content. Small, but it is the sort of untruth that makes
 * someone doubt the rest of a page.
 */
export function useAreaLabel() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return "Administrator";
  if (pathname.startsWith("/office-manager")) return "Office manager";
  if (pathname.startsWith("/caregiver")) return "Caregiver";
  if (pathname.startsWith("/new-hire")) return "New hire";
  if (pathname.startsWith("/client")) return "Client";
  return "Console";
}

/** The heading block at the top of every sheet: eyebrow, title, lead, actions. */
export function SheetHeader({ eyebrow, title, lead, actions }) {
  return (
    <header style={{ marginBottom: 38 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span style={{
          fontFamily: "var(--font-label)", textTransform: "uppercase", fontSize: 11,
          fontWeight: 600, letterSpacing: "0.11em", color: "var(--text-secondary)",
        }}>{eyebrow}</span>
        <span style={{ flex: 1, height: 1, background: "var(--border-paper)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 32 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            margin: 0, fontFamily: "var(--font-display)", fontSize: 40, lineHeight: 1.12,
            letterSpacing: "-0.022em", fontWeight: 500, color: "var(--text-brand)",
          }}>{title}</h1>
          {lead ? (
            <p style={{ margin: "14px 0 0", maxWidth: "58ch", fontSize: 15.5, lineHeight: 1.62, color: "var(--text-muted)" }}>{lead}</p>
          ) : null}
        </div>
        {actions ? <div style={{ display: "flex", gap: 10, paddingBottom: 6 }}>{actions}</div> : null}
      </div>
    </header>
  );
}

/** The scrolling area beside the rail. */
export function Sheet({ children }) {
  return (
    <main className="stage">
      <div className="sheet">{children}</div>
    </main>
  );
}

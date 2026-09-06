import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth, type Role } from "./AuthContext";
// @ts-ignore
import { DTCStore as Store } from "../components/store";
import { supabase } from "../config/supabase";
// @ts-ignore - JS module without types
import { update } from "../lib/db.js";
/** Actions the shell owns, made reachable from the screens it renders. */
interface ShellActions {
  openLinkPhone: () => void;
}
const ShellActionsContext = React.createContext<ShellActions>({ openLinkPhone: () => {} });
export function useShellActions() {
  return React.useContext(ShellActionsContext);
}

interface NavItem {
  to: string;
  label: string;
  icon: string;
  external?: boolean;
  courseHandoff?: boolean;
  /** Only shown once an office manager has released training for this user. */
  needsCourseAccess?: boolean;
}

const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { to: "/admin", label: "Dashboard", icon: "grid" },
    { to: "/admin/templates", label: "Templates", icon: "layers" },
    { to: "/admin/upload", label: "Upload PDF", icon: "upload" },
    // Employment applications from careers.daretocarehomecare.com. Visible
    // to admin as well as office manager — the owner should see these land
    // without having to switch into an office-manager preview to look.
    { to: "/admin/applications", label: "Applications", icon: "users" },
    { to: "/admin/users", label: "Users", icon: "users" },
    { to: "/admin/clients", label: "Clients", icon: "clients" },
    { to: "/admin/audit", label: "Audit log", icon: "clock" },
    { to: "/admin/certificates", label: "Certificates", icon: "file" },
    { to: "https://courses.daretocarehomecare.com", label: "Training Courses", icon: "video", external: true, courseHandoff: true },
  ],
  caregiver: [
    { to: "/caregiver", label: "My Day", icon: "home" },
    { to: "/caregiver/forms", label: "Available Forms", icon: "file" },
    { to: "/caregiver/records", label: "Records", icon: "inbox" },
    { to: "/caregiver/clients", label: "Clients", icon: "users" },
    { to: "https://courses.daretocarehomecare.com", label: "Training Courses", icon: "video", external: true, courseHandoff: true },
  ],
  officeManager: [
    { to: "/office-manager", label: "Dashboard", icon: "grid" },
    { to: "/office-manager/submissions", label: "Submissions", icon: "inbox" },
    // Documents that arrived from outside the app and are not on anyone's
    // record yet. Sits next to Submissions because it is the same job —
    // deciding what a document is and where it belongs — just from the other
    // direction.
    { to: "/office-manager/inbound", label: "Inbound", icon: "upload" },
    { to: "/office-manager/applications", label: "Applications", icon: "users" },
    { to: "/office-manager/clients", label: "Clients", icon: "clients" },
    { to: "/office-manager/new-hires", label: "New hires", icon: "checkCircle" },
    { to: "/office-manager/team", label: "Team", icon: "users" },
    { to: "/office-manager/audit", label: "Audit log", icon: "clock" },
    { to: "https://courses.daretocarehomecare.com", label: "Training Courses", icon: "video", external: true, courseHandoff: true },
  ],
  newHire: [
    { to: "/new-hire", label: "Onboarding", icon: "home" },
    // Hidden until an office manager releases training for this person. Courses
    // are the last step before being hired on, so they are not self-serve.
    { to: "https://courses.daretocarehomecare.com", label: "Training Courses", icon: "video", external: true, courseHandoff: true, needsCourseAccess: true },
  ],
  client: [
    { to: "/client", label: "My Forms", icon: "file" },
  ],
};

const roleLabels: Record<Role, string> = {
  admin: "Administrator",
  caregiver: "Caregiver",
  officeManager: "Office Manager",
  newHire: "New Hire",
  client: "Client",
};

const previewableRoles: { role: Role; label: string; color: string }[] = [
  { role: "caregiver", label: "Caregiver", color: "#2f8a68" },
  { role: "officeManager", label: "Office Mgr", color: "#4c8cf3" },
  { role: "newHire", label: "New Hire", color: "#d7923b" },
  { role: "client", label: "Client", color: "#8b5cf6" },
];

function NavIcon({ name }: { name: string }) {
  const svgProps = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const icons: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </>
    ),
    layers: (
      <>
        <path d="M12 2L2 7l10 5 10-5z" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 3v12" />
        <path d="M8 7l4-4 4 4" />
        <path d="M4 21h16" />
      </>
    ),
    users: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </>
    ),
    clients: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    home: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <path d="M9 22V12h6v10" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
      </>
    ),
    inbox: (
      <>
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    video: (
      <>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    ),
    chevDown: <path d="M6 9l6 6 6-6" />,
    idCard: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M6 16c.5-1.5 1.7-2.5 3-2.5s2.5 1 3 2.5" />
        <path d="M15 9h4M15 13h4" />
      </>
    ),
    phone: <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.2a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z" />,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  };
  return <svg {...svgProps}>{icons[name] || null}</svg>;
}

function useBadgeCounts(role: Role, userId: string) {
  const [counts, setCounts] = useState({ corrections: 0, pendingReview: 0, queued: 0, inbound: 0, applications: 0 });
  useEffect(() => {
    const update = () => {
      const subs = Store.getSubmissions();
      const queued = Store.getQueuedSubmissions?.() ?? [];
      // Only office managers and admins can read the ingestion queue and
      // applications, so for everyone else these are empty and the badges
      // never appear.
      const inbound = Store.getPendingInbound?.().length ?? 0;
      const applications = Store.getPendingApplications?.().length ?? 0;
      if (role === "caregiver") {
        const corrections = subs.filter((s: any) => s.caregiverId === userId && s.status === "needsCorrection").length;
        setCounts({ corrections, pendingReview: 0, queued: queued.length, inbound: 0, applications: 0 });
      } else {
        const pendingReview = subs.filter((s: any) => s.status === "submitted").length;
        setCounts({ corrections: 0, pendingReview, queued: 0, inbound, applications });
      }
    };
    const unsub = Store.subscribe(update);
    return unsub;
  }, [role, userId]);
  return counts;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, enterPreview, exitPreview, effectiveRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [showLinkPhone, setShowLinkPhone] = useState(false);
  const [phoneToLink, setPhoneToLink] = useState("");
  const [linkCode, setLinkCode] = useState("");
  // Holds the phone number a code was just sent to; presence of a value is what
  // switches the modal from "enter number" to "enter code".
  const [linkConfirmation, setLinkConfirmation] = useState<{ phone: string } | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  // Set once a link succeeds, so the confirmation lives in the page rather than
  // in a browser dialog the rest of the app never uses.
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);

  const openLinkPhoneModal = () => {
    setUserMenuOpen(false);
    setShowLinkPhone(true);
    setLinkError(null);
    setLinkConfirmation(null);
    setPhoneToLink("");
    setLinkCode("");
    // No reCAPTCHA to prepare — that was a Firebase phone-auth requirement.
  };

  // Turn an auth error into something the person reading it can act on.
  //
  // "Unable to get SMS provider" is what Supabase returns when phone sign-in is
  // switched on for the project but no SMS provider is configured behind it.
  // That is a workspace setup problem, not something the person clicking the
  // button did wrong or can fix, and showing them the raw string just leaves
  // them retrying a button that cannot work.
  const explainAuthError = (message: string): string => {
    const m = (message || "").toLowerCase();
    if (m.includes("sms provider") || m.includes("error sending confirmation") || m.includes("sms_send_failed")) {
      return "Text-message sign-in isn't switched on for this workspace yet, so no code can be sent. An admin has to connect an SMS service in the Supabase project first.";
    }
    if (m.includes("already registered") || m.includes("already been registered")) {
      return "That number is already linked to another account.";
    }
    if (m.includes("invalid") && m.includes("phone")) {
      return "That doesn't look like a valid phone number. Use a 10-digit US number.";
    }
    if (m.includes("expired")) return "That code has expired. Send a new one.";
    if (m.includes("token") || m.includes("otp")) return "That code isn't right. Check it and try again.";
    if (m.includes("rate") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
    return message || "Something went wrong.";
  };

  // Attaching a phone to an existing account. Firebase called this "linking" a
  // credential; Supabase models it as changing the user's phone attribute,
  // which then has to be confirmed by an SMS code before it takes effect. Same
  // two-step flow from the person's point of view.
  const handleSendLinkCode = async () => {
    setIsLinking(true);
    setLinkError(null);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not logged in");
      const formattedPhone = phoneToLink.startsWith("+") ? phoneToLink : `+1${phoneToLink.replace(/\D/g, "")}`;
      const { error } = await supabase.auth.updateUser({ phone: formattedPhone });
      if (error) throw new Error(error.message);
      setLinkConfirmation({ phone: formattedPhone } as any);
    } catch (err: any) {
      setLinkError(explainAuthError(err.message || "Failed to send code."));
    } finally {
      setIsLinking(false);
    }
  };

  const handleVerifyLinkCode = async () => {
    setIsLinking(true);
    setLinkError(null);
    try {
      const formattedPhone = phoneToLink.startsWith("+") ? phoneToLink : `+1${phoneToLink.replace(/\D/g, "")}`;
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: linkCode,
        type: 'phone_change',
      });
      if (error) throw new Error(error.message);

      // Mirror it onto the profile row, which is what the rest of the app reads.
      await update("users", data.user!.id, { phone: data.user!.phone });
      setShowLinkPhone(false);
      setLinkedPhone(data.user!.phone || formattedPhone);
    } catch (err: any) {
      setLinkError(explainAuthError(err.message || "Invalid code."));
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  const badges = useBadgeCounts(effectiveRole as Role || "caregiver", user?.id ?? "");

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (!user) return <>{children}</>;

  const isPreviewMode = user.role === "admin" && effectiveRole !== "admin" && effectiveRole !== null;
  const displayRole = (effectiveRole ?? user.role) as Role;
  const items = (navByRole[displayRole] || []).filter((item) => {
    // A new hire only sees the courses link once training has been released.
    if (!item.needsCourseAccess) return true;
    return !!(user as any)?.coursesUnlockedAt;
  });

  // Hand the logged-in user into the course site without a second sign-in.
  // Open the tab synchronously (so it isn't popup-blocked), then redirect it to
  // the course site with a one-time token the course site resolves to this user.
  const openCourses = () => {
    const base = "https://courses.daretocarehomecare.com";
    const win = window.open("about:blank", "_blank");
    Store.createCourseHandoff()
      .then((token: string | null) => {
        const dest = token ? `${base}/?h=${encodeURIComponent(token)}` : base;
        if (win) win.location.href = dest;
        else window.open(dest, "_blank");
      })
      .catch(() => {
        if (win) win.location.href = base;
        else window.open(base, "_blank");
      });
  };

  return (
    <div className="shell">
      <header className="shell-mobile-topbar">
        <button className="shell-menu-btn" onClick={() => setSidebarOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="shell-brand-mini">
          <img src="/logo.png" alt="Dare to Care" />
          <strong>Dare to Care</strong>
        </div>
      </header>

      {sidebarOpen ? <div className="shell-overlay" onClick={() => setSidebarOpen(false)} /> : null}

      <aside className={`shell-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="shell-brand">
          <img src="/logo.png" alt="Dare to Care" />
          <div>
            <strong>Dare to Care</strong>
            <span>Home Care Platform</span>
          </div>
        </div>

        <div className="shell-role-label">
          {isPreviewMode ? `Previewing: ${roleLabels[displayRole]}` : roleLabels[displayRole]}
        </div>

        <nav className="shell-nav">
          {items.map((item) => {
            const isRootPath = item.to.split("/").length <= 2;
            const active = isRootPath
              ? location.pathname === item.to || location.pathname === `${item.to}/`
              : location.pathname.startsWith(item.to);

            let badge = 0;
            if (displayRole === "caregiver" && item.to.includes("/caregiver") && isRootPath) {
              badge = badges.corrections + badges.queued;
            } else if (item.label === "Records") {
              badge = badges.corrections;
            } else if (item.label === "Submissions") {
              badge = badges.pendingReview;
            } else if (item.label === "Inbound") {
              badge = badges.inbound;
            } else if (item.label === "Applications") {
              badge = badges.applications;
            }

            // Course site: hand the user off with a one-time token (no second login).
            if (item.courseHandoff) {
              return (
                <button key={item.to} type="button" className="shell-nav-item" onClick={openCourses}>
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              );
            }

            // External links (e.g. the course site on its own subdomain) open in a new tab.
            if (item.external) {
              return (
                <a key={item.to} href={item.to} target="_blank" rel="noreferrer" className="shell-nav-item">
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </a>
              );
            }

            return (
              <NavLink key={item.to} to={item.to} end={isRootPath} className={({ isActive }) => `shell-nav-item${active || isActive ? " active" : ""}`}>
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
                {badge > 0 && <span className="nav-badge">{badge > 99 ? "99+" : badge}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Admin role switcher */}
        {user.role === "admin" && (
          <div className="role-switcher">
            <div className="role-switcher-label">Preview as role</div>
            <div className="role-switcher-grid">
              {previewableRoles.map(({ role, label }) => (
                <button
                  key={role}
                  className={`role-chip ${displayRole === role ? "active" : ""}`}
                  onClick={() => {
                    if (displayRole === role) {
                      exitPreview();
                      navigate("/admin");
                    } else {
                      const homePaths: Record<Role, string> = {
                        admin: "/admin",
                        caregiver: "/caregiver",
                        officeManager: "/office-manager",
                        newHire: "/new-hire",
                        client: "/client",
                      };
                      enterPreview(role);
                      navigate(homePaths[role]);
                    }
                  }}
                >
                  <div className="role-chip-dot" />
                  {label}
                </button>
              ))}
            </div>
            {isPreviewMode && (
              <button
                style={{ width: "100%", marginTop: 8, padding: "7px 10px", borderRadius: 10, fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", textAlign: "center", border: "1px solid var(--border)" }}
                onClick={() => { exitPreview(); navigate("/admin"); }}
              >
                ← Back to admin
              </button>
            )}
          </div>
        )}

        <div className="shell-sidebar-foot">
          <div className="shell-user" onClick={() => setUserMenuOpen((open) => !open)}>
            <span className="shell-avatar">{user.initials}</span>
            <span className="shell-user-info">
              <strong>{user.name}</strong>
              <span>{isPreviewMode ? `Admin · Previewing ${roleLabels[displayRole]}` : user.email}</span>
            </span>
            <NavIcon name="chevDown" />
          </div>
          {userMenuOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button
                className="shell-logout"
                style={{ borderBottom: '1px solid var(--border)', borderRadius: '8px 8px 0 0' }}
                onClick={() => { setUserMenuOpen(false); navigate("/profile"); }}
              >
                <NavIcon name="idCard" />
                My profile
              </button>
              <button
                className="shell-logout"
                style={{ borderBottom: '1px solid var(--border)' }}
                onClick={openLinkPhoneModal}
              >
                <NavIcon name="phone" />
                Link phone number
              </button>
              <button
                className="shell-logout"
                style={{ borderRadius: '0 0 8px 8px' }}
                onClick={async () => {
                  await logout();
                  navigate("/login", { replace: true });
                }}
              >
                <NavIcon name="logout" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="shell-main">
        {isPreviewMode && (
          <div className="preview-banner">
            <NavIcon name="eye" />
            <span>Admin preview mode — viewing as <strong>{roleLabels[displayRole]}</strong>. Changes won't affect real data.</span>
            <button className="preview-banner-exit" onClick={() => { exitPreview(); navigate("/admin"); }}>
              Exit preview
            </button>
          </div>
        )}
        {isOffline && (
          <div className="offline-banner" role="status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0119 12.55" /><path d="M5 12.55a10.94 10.94 0 015.17-2.39" /><path d="M10.71 5.05A16 16 0 0122.56 9" /><path d="M1.42 9a15.91 15.91 0 014.7-2.88" /><path d="M8.53 16.11a6 6 0 016.95 0" /><circle cx="12" cy="20" r="1" />
            </svg>
            You're offline — forms will be queued and submitted when you reconnect
          </div>
        )}
        <div className="shell-main-inner">
          <ShellActionsContext.Provider value={{ openLinkPhone: openLinkPhoneModal }}>
            {children}
          </ShellActionsContext.Provider>
        </div>
        <footer className="shell-footer">
          <span>Dare to Care · Home Care Platform</span>
          <span>Role-based access · Secure PDFs</span>
        </footer>
      </main>

      {linkedPhone && (
        <div
          role="status"
          className="offline-banner"
          style={{ background: "var(--success-bg, #E4F0E7)", color: "var(--status-success, #1E6848)" }}
        >
          <span>Phone number linked — you can now sign in with {linkedPhone}.</span>
          <button className="preview-banner-exit" onClick={() => setLinkedPhone(null)}>Dismiss</button>
        </div>
      )}

      {showLinkPhone && (
        <div className="modal-overlay" onClick={() => !isLinking && setShowLinkPhone(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Link Phone Number</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', marginBottom: '1.5rem' }}>
              Link your phone number to sign in using SMS verification codes instead of a password.
            </p>

            {linkError && <div className="login-error" style={{ marginBottom: '1rem' }}>{linkError}</div>}

            {!linkConfirmation ? (
              <>
                <label className="login-field">
                  <span>Phone Number</span>
                  <input 
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phoneToLink}
                    onChange={(e) => setPhoneToLink(e.target.value)}
                    disabled={isLinking}
                  />
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem' }}>
                  <button className="dbtn dbtn-secondary" onClick={() => setShowLinkPhone(false)}>Cancel</button>
                  <button className="dbtn dbtn-primary" onClick={handleSendLinkCode} disabled={isLinking || !phoneToLink}>
                    {isLinking ? "Sending..." : "Send Code"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="login-field">
                  <span>Verification Code</span>
                  <input 
                    type="text"
                    placeholder="123456"
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value)}
                    disabled={isLinking}
                  />
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem' }}>
                  <button className="dbtn dbtn-secondary" onClick={() => setShowLinkPhone(false)}>Cancel</button>
                  <button className="dbtn dbtn-primary" onClick={handleVerifyLinkCode} disabled={isLinking || !linkCode}>
                    {isLinking ? "Verifying..." : "Verify & Link"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

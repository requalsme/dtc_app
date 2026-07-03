import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth, type Role } from "./AuthContext";
// @ts-ignore
import { DTCStore as Store } from "../components/store";
import { linkWithPhoneNumber, RecaptchaVerifier, type ConfirmationResult } from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, updateDoc } from "firebase/firestore";
interface NavItem {
  to: string;
  label: string;
  icon: string;
  external?: boolean;
  courseHandoff?: boolean;
}

const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { to: "/admin", label: "Dashboard", icon: "grid" },
    { to: "/admin/templates", label: "Templates", icon: "layers" },
    { to: "/admin/upload", label: "Upload PDF", icon: "upload" },
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
    { to: "/office-manager/clients", label: "Clients", icon: "clients" },
    { to: "/office-manager/team", label: "Team", icon: "users" },
    { to: "/office-manager/audit", label: "Audit log", icon: "clock" },
    { to: "https://courses.daretocarehomecare.com", label: "Training Courses", icon: "video", external: true, courseHandoff: true },
  ],
  newHire: [
    { to: "/new-hire", label: "Onboarding", icon: "home" },
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
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  };
  return <svg {...svgProps}>{icons[name] || null}</svg>;
}

function useBadgeCounts(role: Role, userId: string) {
  const [counts, setCounts] = useState({ corrections: 0, pendingReview: 0, queued: 0 });
  useEffect(() => {
    const update = () => {
      const subs = Store.getSubmissions();
      const queued = Store.getQueuedSubmissions?.() ?? [];
      if (role === "caregiver") {
        const corrections = subs.filter((s: any) => s.caregiverId === userId && s.status === "needsCorrection").length;
        setCounts({ corrections, pendingReview: 0, queued: queued.length });
      } else {
        const pendingReview = subs.filter((s: any) => s.status === "submitted").length;
        setCounts({ corrections: 0, pendingReview, queued: 0 });
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
  const [linkConfirmation, setLinkConfirmation] = useState<ConfirmationResult | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const openLinkPhoneModal = () => {
    setUserMenuOpen(false);
    setShowLinkPhone(true);
    setLinkError(null);
    setLinkConfirmation(null);
    setPhoneToLink("");
    setLinkCode("");
    setTimeout(() => {
      if (!(window as any).recaptchaVerifierLink) {
        (window as any).recaptchaVerifierLink = new RecaptchaVerifier(auth, 'recaptcha-link-container', {
          size: 'invisible',
        });
      }
    }, 100);
  };

  const handleSendLinkCode = async () => {
    setIsLinking(true);
    setLinkError(null);
    try {
      if (!auth.currentUser) throw new Error("Not logged in");
      const appVerifier = (window as any).recaptchaVerifierLink;
      const formattedPhone = phoneToLink.startsWith("+") ? phoneToLink : `+1${phoneToLink.replace(/\D/g, "")}`;
      const result = await linkWithPhoneNumber(auth.currentUser, formattedPhone, appVerifier);
      setLinkConfirmation(result);
    } catch (err: any) {
      setLinkError(err.message || "Failed to send code.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleVerifyLinkCode = async () => {
    setIsLinking(true);
    setLinkError(null);
    try {
      const result = await linkConfirmation!.confirm(linkCode);
      // Success, update firestore
      await updateDoc(doc(db, "users", result.user.uid), { phone: result.user.phoneNumber });
      setShowLinkPhone(false);
      alert("Phone number linked successfully! You can now log in using your phone number.");
    } catch (err: any) {
      setLinkError(err.message || "Invalid code.");
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
  const items = navByRole[displayRole] || [];

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
                onClick={openLinkPhoneModal}
              >
                <NavIcon name="clock" />
                Link Phone Number
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
        <div className="shell-main-inner">{children}</div>
        <footer className="shell-footer">
          <span>Dare to Care · Home Care Platform</span>
          <span>Role-based access · Secure PDFs</span>
        </footer>
      </main>

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
                <div id="recaptcha-link-container"></div>
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

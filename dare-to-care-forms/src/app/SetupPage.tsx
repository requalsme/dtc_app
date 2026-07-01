import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc, getDocs, collection, limit, query } from "firebase/firestore";
import { auth, db } from "../config/firebase";

export default function SetupPage() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"welcome" | "form" | "done">("welcome");
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there are ANY users in the database. If there are, setup is locked.
    const checkSetupStatus = async () => {
      try {
        const usersSnap = await getDocs(query(collection(db, "users"), limit(1)));
        if (!usersSnap.empty) {
          // A user exists, redirect to login
          navigate('/login');
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError("Could not connect to database to verify setup status.");
        setLoading(false);
      }
    };
    checkSetupStatus();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // 1. Create the user in Firebase Auth
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Determine initials for avatar
      const initials = name.split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2) || '?';
      
      // 3. Create the user document in Firestore with the exact Auth UID
      await setDoc(doc(db, "users", userCred.user.uid), {
        name: name.trim(),
        email: email.toLowerCase(),
        initials,
        role: "admin",
        status: "active",
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });

      // 4. Firebase automatically signs them in! 
      setStep("done");
      
      // Navigate straight to the admin dashboard after a brief delay
      setTimeout(() => {
        navigate("/admin", { replace: true });
      }, 2500);

    } catch (err: any) {
      console.error(err);
      // Friendly Firebase error messages
      if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (err.code === "auth/weak-password") {
        setError("Your password is too weak. Please use a stronger password.");
      } else {
        setError(err.message || "Failed to create administrator account.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="setup-page">
        <div className="setup-loader">
          <div className="setup-spinner" />
          <span>Verifying environment…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-page">
      <div className="setup-container">
        {/* Brand mark */}
        <div className="setup-brand">
          <div className="setup-brand-logo">
            <img src="/logo.png" alt="Dare to Care" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div className="setup-brand-icon">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
                <rect width="40" height="40" rx="12" fill="#143d23"/>
                <path d="M20 10c0 0-8 5-8 12a8 8 0 0016 0c0-7-8-12-8-12z" fill="#4ade80" opacity=".9"/>
                <path d="M20 16c0 0-4 3-4 6a4 4 0 008 0c0-3-4-6-4-6z" fill="#ffffff" opacity=".8"/>
              </svg>
            </div>
          </div>
          <div>
            <strong className="setup-brand-name">Dare to Care</strong>
            <span className="setup-brand-sub">Home Care Platform</span>
          </div>
        </div>

        {step === "done" ? (
          <div className="setup-done" style={{ animation: "fadeIn 0.5s ease" }}>
            <div className="setup-done-icon" style={{ background: "var(--accent-1)", color: "#fff", padding: 16, borderRadius: "50%", marginBottom: 16, display: "inline-block" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h2>You're all set!</h2>
            <p>Your administrator account has been created and you are securely logged in.</p>
            <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 8 }}>Routing you to the dashboard...</p>
          </div>
        ) : step === "welcome" ? (
          <div className="setup-welcome">
            <div className="setup-welcome-badge">First-time setup</div>
            <h1 className="setup-welcome-title">Welcome to Dare to Care</h1>
            <p className="setup-welcome-desc">
              This looks like a fresh installation. Let's create your master administrator account to secure the platform.
            </p>
            <div className="setup-welcome-features">
              <div className="setup-feature">
                <div className="setup-feature-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                </div>
                <div>
                  <strong>Team management</strong>
                  <span>Add caregivers, office staff, and new hires</span>
                </div>
              </div>
              <div className="setup-feature">
                <div className="setup-feature-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>
                </div>
                <div>
                  <strong>Forms & submissions</strong>
                  <span>Build templates, review completed forms, generate PDFs</span>
                </div>
              </div>
              <div className="setup-feature">
                <div className="setup-feature-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z"/></svg>
                </div>
                <div>
                  <strong>Training & onboarding</strong>
                  <span>Track new hire progress through required modules</span>
                </div>
              </div>
            </div>
            <button className="setup-cta" onClick={() => setStep("form")}>
              Create administrator account
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            </button>
          </div>
        ) : (
          <div className="setup-form-wrap">
            <button className="setup-back" onClick={() => setStep("welcome")}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
              Back
            </button>
            <h2 className="setup-form-title">Create your account</h2>
            <p className="setup-form-sub">Set up your secure master administrator credentials below. You will use these to log into the platform.</p>

            {error && <div className="setup-error">{error}</div>}

            <form className="setup-form" onSubmit={handleSubmit}>
              <div className="setup-field">
                <label htmlFor="setup-name">Full Name</label>
                <input
                  id="setup-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  required
                  autoComplete="name"
                />
              </div>

              <div className="setup-field">
                <label htmlFor="setup-email">Admin Email Address</label>
                <input
                  id="setup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase().replace(/\s/g, ""))}
                  placeholder="e.g. admin@daretocare.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="setup-field">
                <label htmlFor="setup-password">Secure Password</label>
                <div className="setup-password-wrap">
                  <input
                    id="setup-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button type="button" className="setup-eye" onClick={() => setShowPassword((v) => !v)} tabIndex={-1} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="setup-field">
                <label htmlFor="setup-confirm-password">Confirm Password</label>
                <div className="setup-password-wrap">
                  <input
                    id="setup-confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Type your password again"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    style={{ borderColor: confirmPassword && password !== confirmPassword ? "var(--danger)" : undefined }}
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <span style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 4, display: "block" }}>Passwords do not match</span>
                )}
              </div>

              <button className="setup-submit" type="submit" disabled={submitting || (!!confirmPassword && password !== confirmPassword)}>
                {submitting ? (
                  <><div className="setup-spinner-sm" /> Securing account…</>
                ) : (
                  <>Complete setup</>
                )}
              </button>
            </form>
          </div>
        )}

        <div className="setup-footer">
          <span>DARE to Care Home Care</span>
          <span>·</span>
          <span>Non-medical home care platform</span>
        </div>
      </div>
    </div>
  );
}

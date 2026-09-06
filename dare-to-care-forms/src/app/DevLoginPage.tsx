import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// The separate gate onto the dev portal. Same account, same password as the
// normal login — the thing that's different is the check that runs after:
// this only succeeds if the account has devAccess set, and it deliberately
// looks nothing like the ordinary sign-in screen so it's never ambiguous
// which one someone is looking at. Dark, badge-marked, same brand colors.
export default function DevLoginPage() {
  const navigate = useNavigate();
  const { devLogin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await devLogin(email, password);
      navigate("/dev", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--surface-inverse)", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-ui)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, padding: "0 1rem" }}>
        <button
          type="button"
          onClick={() => navigate("/login")}
          style={{
            display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
            color: "#9fc4ab", fontSize: "0.85rem", cursor: "pointer", marginBottom: "1.5rem", padding: "6px 0",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to sign in
        </button>

        <section
          style={{
            background: "rgba(255,255,255,.04)", border: "1px solid var(--border-inverse-strong)", borderRadius: "var(--radius-modal)",
            padding: "2rem", boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
            <img src="/logo.png" alt="Dare to Care" style={{ width: 34, height: 34, borderRadius: 8 }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ color: "var(--text-on-inverse)" }}>Dare to Care</strong>
                <span style={{
                  fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "#e6b552", border: "1px solid #6b551f", background: "#2e2a1f",
                  borderRadius: 999, padding: "2px 8px",
                }}>
                  Dev portal
                </span>
              </div>
              <span style={{ color: "#9fc4ab", fontSize: "0.8rem" }}>Not the normal sign-in — go back if you meant that one.</span>
            </div>
          </div>

          {error && (
            <div style={{
              background: "#2e1f1f", border: "1px solid #6b2a2a", color: "#f08a8a",
              borderRadius: "var(--radius-input)", padding: "0.6rem 0.8rem", fontSize: "0.85rem", marginBottom: "1rem",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#c9d6cc", fontSize: "0.8rem" }}>Email address</span>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" required
                style={{ background: "rgba(0,0,0,.28)", border: "1px solid var(--border-inverse-strong)", borderRadius: "var(--radius-input)", padding: "0.6rem 0.75rem", color: "var(--text-on-inverse)", font: "inherit" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#c9d6cc", fontSize: "0.8rem" }}>Password</span>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" required
                style={{ background: "rgba(0,0,0,.28)", border: "1px solid var(--border-inverse-strong)", borderRadius: "var(--radius-input)", padding: "0.6rem 0.75rem", color: "var(--text-on-inverse)", font: "inherit" }}
              />
            </label>
            <button
              type="submit" disabled={isSubmitting}
              style={{
                background: "#e6b552", color: "#1c1c1a", border: "none", borderRadius: "var(--radius-cta)",
                padding: "0.7rem", fontWeight: 700, cursor: "pointer", marginTop: "0.25rem",
              }}
            >
              {isSubmitting ? "Checking..." : "Enter dev portal"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, type Role } from "./AuthContext";

const homeByRole: Record<Role, string> = {
  admin: "/admin",
  caregiver: "/caregiver",
  officeManager: "/office-manager",
  newHire: "/new-hire",
  client: "/client",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(location.state?.message || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    import("firebase/firestore").then(async ({ getDocs, collection, limit, query }) => {
      const { db } = await import("../config/firebase");
      const usersSnap = await getDocs(query(collection(db, "users"), limit(1)));
      if (usersSnap.empty) {
        navigate('/setup');
      }
    }).catch(console.error);
  }, [navigate]);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const user = await login(email, password);
      if (user.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(homeByRole[user.role], { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-stage" style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <section className="login-intro" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="login-brand-row" style={{ justifyContent: 'center' }}>
            <img src="/logo.png" alt="Dare to Care" className="login-logo-mark" />
            <div style={{ textAlign: 'left' }}>
              <strong>Dare to Care</strong>
              <span>Forms Platform</span>
            </div>
          </div>
        </section>

        <section className="login-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
          <div className="login-panel-head">
            <div>
              <h2>Sign in</h2>
              <p>Welcome back. Please sign in to your workspace.</p>
            </div>
          </div>

          {message && <div className="login-message" style={{ color: 'green', marginBottom: '1rem', padding: '0.5rem', background: '#e6ffe6', borderRadius: '4px' }}>{message}</div>}
          {error && <div className="login-error">{error}</div>}

          <form className="login-form" onSubmit={submit}>
            <label className="login-field">
              <span>Email Address</span>
              <input 
                type="email"
                value={email} 
                onChange={(event) => setEmail(event.target.value)} 
                autoComplete="email" 
                required 
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button className="login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Open workspace"}
            </button>
          </form>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--slate-500)' }}>
            Need access? Contact your administrator.
          </div>
        </section>
      </div>
    </div>
  );
}

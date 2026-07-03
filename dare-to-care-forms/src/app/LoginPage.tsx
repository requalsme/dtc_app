import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, type Role } from "./AuthContext";
import { signInWithPhoneNumber, RecaptchaVerifier, type ConfirmationResult } from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";

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
  
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  
  // Email Auth State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Phone Auth State
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(location.state?.message || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "metadata", "setup")).then((snap) => {
      if (!snap.exists()) {
        navigate('/setup');
      }
    }).catch(console.error);
    
    // Initialize recaptcha when on phone login
    if (loginMethod === "phone" && !(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  }, [navigate, loginMethod]);

  const submitEmail = async (e?: React.FormEvent) => {
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

  const sendPhoneCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to send verification code.");
      if ((window as any).recaptchaVerifier) {
         try {
           (window as any).recaptchaVerifier.render().then((widgetId: any) => {
             (window as any).grecaptcha.reset(widgetId);
           });
         } catch(e) {}
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyPhoneCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await confirmationResult!.confirm(verificationCode);
      const userDoc = await getDoc(doc(db, "users", result.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.mustChangePassword) {
          navigate('/change-password', { replace: true });
        } else {
          navigate(homeByRole[userData.role as Role], { replace: true });
        }
      } else {
        setError("User profile not found in database.");
      }
    } catch (err: any) {
      setError(err.message || "Invalid verification code.");
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

          <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
            <button 
              type="button"
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: loginMethod === 'email' ? 'var(--bg-elevated)' : 'transparent', fontWeight: loginMethod === 'email' ? 600 : 400 }}
              onClick={() => { setLoginMethod('email'); setConfirmationResult(null); setError(null); }}
            >
              Email
            </button>
            <button 
              type="button"
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: loginMethod === 'phone' ? 'var(--bg-elevated)' : 'transparent', fontWeight: loginMethod === 'phone' ? 600 : 400 }}
              onClick={() => { setLoginMethod('phone'); setError(null); }}
            >
              Phone Number
            </button>
          </div>

          {message && <div className="login-message" style={{ color: 'green', marginBottom: '1rem', padding: '0.5rem', background: '#e6ffe6', borderRadius: '4px' }}>{message}</div>}
          {error && <div className="login-error">{error}</div>}

          {loginMethod === "email" ? (
            <form className="login-form" onSubmit={submitEmail}>
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
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={confirmationResult ? verifyPhoneCode : sendPhoneCode}>
              {!confirmationResult ? (
                <>
                  <label className="login-field">
                    <span>Phone Number</span>
                    <input 
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phone} 
                      onChange={(event) => setPhone(event.target.value)} 
                      required 
                    />
                  </label>
                  <div id="recaptcha-container"></div>
                  <button className="login-submit" type="submit" disabled={isSubmitting || !phone}>
                    {isSubmitting ? "Sending..." : "Send Verification Code"}
                  </button>
                </>
              ) : (
                <>
                  <label className="login-field">
                    <span>Verification Code</span>
                    <input 
                      type="text"
                      placeholder="123456"
                      value={verificationCode} 
                      onChange={(event) => setVerificationCode(event.target.value)} 
                      required 
                    />
                  </label>
                  <button className="login-submit" type="submit" disabled={isSubmitting || !verificationCode}>
                    {isSubmitting ? "Verifying..." : "Sign in"}
                  </button>
                  <button type="button" className="dbtn dbtn-ghost" style={{ width: '100%', marginTop: '8px' }} onClick={() => setConfirmationResult(null)}>
                    Use a different number
                  </button>
                </>
              )}
            </form>
          )}
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--slate-500)' }}>
            Need access? Contact your administrator.
          </div>
        </section>
      </div>
    </div>
  );
}

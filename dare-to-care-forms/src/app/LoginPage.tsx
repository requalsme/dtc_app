import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, type Role } from "./AuthContext";
import { supabase } from "../config/supabase";
// @ts-ignore - JS module without types
import { fromRow } from "../lib/records.js";

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
  // Supabase's OTP flow is stateless between the two steps — the code is
  // verified against the phone number rather than against a handle returned by
  // the send call — so this tracks only whether a code is outstanding.
  const [codeSent, setCodeSent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(location.state?.message || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Deliberately readable signed-out: this decides whether to send a brand
    // new install to first-run setup, before anyone can be logged in.
    supabase
      .from("app_metadata")
      .select("id")
      .eq("id", "setup")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) navigate('/setup');
      });
    // No reCAPTCHA setup: that was a Firebase phone-auth requirement.
    // Supabase rate-limits OTP sends server-side instead.
  }, [navigate]);

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
      const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (otpError) throw new Error(otpError.message);
      setCodeSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyPhoneCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: verificationCode,
        type: 'sms',
      });
      if (verifyError) throw new Error(verifyError.message);

      const { data: row } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user!.id)
        .maybeSingle();

      if (row) {
        const userData = fromRow("users", row);
        if (userData.mustChangePassword) {
          navigate('/change-password', { replace: true });
        } else {
          navigate(homeByRole[userData.role as Role], { replace: true });
        }
      } else {
        // A verified phone with no profile cannot be placed in the app; don't
        // leave them half-authenticated on the login screen.
        await supabase.auth.signOut();
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
              onClick={() => { setLoginMethod('email'); setCodeSent(false); setError(null); }}
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
            <form className="login-form" onSubmit={codeSent ? verifyPhoneCode : sendPhoneCode}>
              {!codeSent ? (
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
                  <button type="button" className="dbtn dbtn-ghost" style={{ width: '100%', marginTop: '8px' }} onClick={() => setCodeSent(false)}>
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

        {/* Off to the side and small on purpose — this is not the door most
            people should notice, let alone use. Everyone with an account signs
            in above, including people who also have dev access; this is only
            a shortcut to the separate gate for that second grant. */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => navigate('/dev-login')}
            style={{ background: 'none', border: 'none', color: 'var(--slate-400)', fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer', padding: '4px' }}
          >
            Dev login
          </button>
        </div>
      </div>
    </div>
  );
}

// Staff sign-in, rebuilt on the design system's OfficeSignIn composition.
//
// Centred, light, one narrow column on paper with the leaf behind it —
// deliberately not the training portal's dark split plate, so the two doors
// into the product never read as the same screen.
//
// The kit's version was a demo with a four-digit access code. The real flows
// are unchanged: email + password through Supabase Auth, or SMS one-time code.

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, type Role } from "./AuthContext";
import { supabase } from "../config/supabase";
// @ts-ignore - JS module without types
import { fromRow } from "../lib/records.js";
// @ts-ignore - JSX modules without types
import { Icon, Logo, Button, Input, Panel, MonoLabel, Rule, Banner } from "../design/index.js";

const homeByRole: Record<Role, string> = {
  admin: "/admin",
  caregiver: "/caregiver",
  officeManager: "/office-manager",
  newHire: "/new-hire",
  client: "/client",
};

/** Morning / afternoon / evening — the brand speaks like a colleague. */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>((location.state as any)?.message || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Readable signed-out by design: this decides whether a brand new install
    // should go to first-run setup, before anyone can possibly be logged in.
    supabase
      .from("app_metadata")
      .select("id")
      .eq("id", "setup")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) navigate("/setup");
      });
  }, [navigate]);

  const goHome = (userData: any) => {
    if (userData.mustChangePassword) navigate("/change-password", { replace: true });
    else navigate(homeByRole[userData.role as Role] || "/", { replace: true });
  };

  const submitEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      goHome(await login(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalisedPhone = () => (phone.startsWith("+") ? phone : "+1" + phone.replace(/\D/g, ""));

  const sendPhoneCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalisedPhone() });
      if (otpError) throw new Error(otpError.message);
      setCodeSent(true);
    } catch (err: any) {
      setError(err.message || "We couldn't send that code. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyPhoneCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalisedPhone(),
        token: verificationCode,
        type: "sms",
      });
      if (verifyError) throw new Error(verifyError.message);

      const { data: row } = await supabase.from("users").select("*").eq("id", data.user!.id).maybeSingle();
      if (row) {
        goHome(fromRow("users", row));
      } else {
        // A verified phone with no profile cannot be placed in the app; don't
        // leave them half-authenticated on the login screen.
        await supabase.auth.signOut();
        setError("We don't have a profile for that number yet.");
      }
    } catch (err: any) {
      setError(err.message || "That code didn't work. Check it and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailReady = email.includes("@") && password.length > 0;

  return (
    <div className="dtc-auth-page">
      <img className="dtc-auth-mark" src="/brand/assets/mark-leaf.png" alt="" />

      <form
        className="dtc-auth-col"
        onSubmit={method === "email" ? submitEmail : codeSent ? verifyPhoneCode : sendPhoneCode}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Logo width={214} basePath="/brand" />
        </div>

        <div style={{ marginTop: 28, textAlign: "center" }}>
          <MonoLabel style={{ justifyContent: "center" }}>Staff sign in</MonoLabel>
          <h1 style={{
            margin: "11px 0 0", fontFamily: "var(--font-display)", fontWeight: 500,
            fontSize: 31, lineHeight: 1.18, letterSpacing: "-0.022em", color: "var(--brand-accent)",
          }}>{greeting()}</h1>
        </div>

        {message && (
          <div style={{ marginTop: 18 }}>
            <Banner tone="success">{message}</Banner>
          </div>
        )}

        {/* One framed sheet, hairline only — this screen never needs a shadow. */}
        <Panel padding={24} style={{ marginTop: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 17 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {(["email", "phone"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={method === m ? "secondary" : "ghost"}
                  size="sm"
                  fullWidth
                  onClick={() => { setMethod(m); setError(null); setCodeSent(false); }}
                >
                  {m === "email" ? "Email" : "Phone"}
                </Button>
              ))}
            </div>

            {method === "email" ? (
              <>
                <Input
                  label="Work email"
                  type="email"
                  value={email}
                  onChange={(e: any) => setEmail(e.target.value)}
                  placeholder="you@daretocarehomecare.com"
                  autoComplete="email"
                  iconLeft={<Icon name="users" size={17} />}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e: any) => { setPassword(e.target.value); setError(null); }}
                  error={error || undefined}
                  autoComplete="current-password"
                  iconRight={<Icon name="lock" size={17} />}
                  required
                />
                <Button size="lg" fullWidth type="submit" disabled={!emailReady || isSubmitting}
                  iconRight={<Icon name="chevron" size={18} />}>
                  {isSubmitting ? "Signing in…" : "Sign in"}
                </Button>
              </>
            ) : !codeSent ? (
              <>
                <Input
                  label="Mobile number"
                  type="tel"
                  value={phone}
                  onChange={(e: any) => { setPhone(e.target.value); setError(null); }}
                  placeholder="(720) 555-0148"
                  error={error || undefined}
                  autoComplete="tel"
                  required
                />
                <Button size="lg" fullWidth type="submit" disabled={!phone || isSubmitting}
                  iconRight={<Icon name="send" size={17} />}>
                  {isSubmitting ? "Sending…" : "Text me a code"}
                </Button>
              </>
            ) : (
              <>
                <Input
                  label="Six-digit code"
                  value={verificationCode}
                  onChange={(e: any) => { setVerificationCode(e.target.value); setError(null); }}
                  hint={error ? undefined : "Sent to " + phone}
                  error={error || undefined}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  required
                />
                <Button size="lg" fullWidth type="submit" disabled={!verificationCode || isSubmitting}>
                  {isSubmitting ? "Checking…" : "Sign in"}
                </Button>
                <Button type="button" variant="ghost" size="sm" fullWidth onClick={() => setCodeSent(false)}>
                  Use a different number
                </Button>
              </>
            )}
          </div>
        </Panel>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 9, justifyContent: "center" }}>
          <Icon name="lock" size={14} style={{ color: "var(--text-quiet)" }} />
          <span style={{ fontSize: 13, color: "var(--text-quiet)" }}>
            Protected health information · your session ends when you sign out
          </span>
        </div>

        <Rule mark style={{ margin: "20px 0 14px" }} />

        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Need access? Ask your administrator.
          </span>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-quiet)" }}>Need a hand — call (720) 842-2153</span>
          </div>
        </div>
      </form>
    </div>
  );
}

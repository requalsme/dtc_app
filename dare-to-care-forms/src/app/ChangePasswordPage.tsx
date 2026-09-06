// Choose a password — the first screen anyone sees on their first sign-in.
//
// Built on the same composition as the sign-in page, because it is the same
// door: a person is still standing outside the product. Making it look like a
// different screen would suggest something had gone wrong.
//
// It previously used class names the stylesheet never defined (login-container,
// login-card, login-btn), so every rule silently no-opped and it rendered as
// unstyled browser HTML. A misspelt CSS class is not an error, it is nothing.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
// @ts-ignore - JS module without types
import { update } from '../lib/db.js';
// @ts-ignore - JSX modules without types
import { Icon, Logo, Button, Input, Panel, MonoLabel, Rule } from '../design/index.js';

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user || !user.mustChangePassword) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError("Those two don't match.");
      return;
    }
    if (newPassword.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }

    setBusy(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("You're signed out. Sign in again.");

      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) throw new Error(pwError.message);

      await update("users", authUser.id, { mustChangePassword: false });

      // Signed out on purpose, so the new password is used at least once and
      // is therefore known to work before anyone relies on it.
      await logout();
      navigate('/login', { state: { message: "Password saved. Sign in with it now." } });
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  const ready = newPassword.length >= 10 && confirmPassword.length > 0;

  return (
    <div className="dtc-auth-page">
      <img className="dtc-auth-mark" src="/brand/assets/mark-leaf.png" alt="" />

      <form className="dtc-auth-col" onSubmit={handleSubmit}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Logo width={214} basePath="/brand" />
        </div>

        <div style={{ marginTop: 28, textAlign: "center" }}>
          <MonoLabel style={{ justifyContent: "center" }}>First sign in</MonoLabel>
          <h1 style={{
            margin: "11px 0 0", fontFamily: "var(--font-display)", fontWeight: 500,
            fontSize: 31, lineHeight: 1.18, letterSpacing: "-0.022em", color: "var(--brand-accent)",
          }}>Choose a password</h1>
          <p style={{ margin: "12px auto 0", maxWidth: "34ch", fontSize: 15, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            Welcome, {user.name}. Pick something only you know — the one you were given was temporary.
          </p>
        </div>

        <Panel padding={24} style={{ marginTop: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 17 }}>
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e: any) => { setNewPassword(e.target.value); setError(''); }}
              hint={error ? undefined : "At least 10 characters"}
              // Tells the browser this is a password being set, not one to
              // recall — without it, autofill offers the person's existing one.
              autoComplete="new-password"
              iconRight={<Icon name="lock" size={17} />}
              required
              minLength={10}
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e: any) => { setConfirmPassword(e.target.value); setError(''); }}
              error={error || undefined}
              autoComplete="new-password"
              required
              minLength={10}
            />
            <Button size="lg" fullWidth type="submit" disabled={!ready || busy}
              iconRight={<Icon name="chevron" size={18} />}>
              {busy ? "Saving…" : "Save password"}
            </Button>
          </div>
        </Panel>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 9, justifyContent: "center" }}>
          <Icon name="lock" size={14} style={{ color: "var(--text-quiet)" }} />
          <span style={{ fontSize: 13, color: "var(--text-quiet)" }}>
            You'll sign in again with the new one
          </span>
        </div>

        <Rule mark style={{ margin: "20px 0 14px" }} />

        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-quiet)" }}>Need a hand — call (720) 842-2153</span>
        </div>
      </form>
    </div>
  );
}

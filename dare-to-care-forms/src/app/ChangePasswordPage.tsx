import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
// @ts-ignore - JS module without types
import { update } from '../lib/db.js';

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
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
      setError("Passwords do not match.");
      return;
    }
    
    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters long.");
      return;
    }

    try {
      // Imported statically now. These were dynamic only to keep the Firebase
      // SDK out of the main bundle; the Supabase client is already in it,
      // loaded by the app shell before this screen can ever render.
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");

      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) throw new Error(pwError.message);

      await update("users", authUser.id, { mustChangePassword: false });

      // Logout to force them to use their new password
      await logout();
      navigate('/login', { state: { message: "Password updated successfully! Please log in again." } });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    // Class names here must match the ones the stylesheet actually defines.
    // This screen previously used login-container / login-card / login-btn,
    // none of which exist, so every rule silently no-opped and the page
    // rendered as unstyled browser HTML. A misspelt CSS class is not an error,
    // it is simply nothing - which is why it survived until the first person
    // signed in and was sent straight here.
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
              <h2>Choose a password</h2>
              <p>Welcome, {user.name}. Set your own password before continuing.</p>
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
            </label>
            <label className="login-field">
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="login-submit">Update password</button>
          </form>
        </section>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';


export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  // Wait for the auth profile to load before deciding — otherwise a page
  // refresh here bounces the user away even though they still must change
  // their password.
  useEffect(() => {
    if (!isLoading && (!user || !user.mustChangePassword)) navigate('/', { replace: true });
  }, [isLoading, user, navigate]);

  if (isLoading || !user || !user.mustChangePassword) return null;

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
      const { updatePassword } = await import('firebase/auth');
      const { auth, db } = await import('../config/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');

      if (!auth.currentUser) throw new Error("Not authenticated");

      await updatePassword(auth.currentUser, newPassword);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        mustChangePassword: false
      });
      
      // Logout to force them to use their new password
      await logout();
      navigate('/login', { state: { message: "Password updated successfully! Please log in again." } });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Change Your Password</h2>
        <p>Welcome, {user.name}. You must change your temporary password before continuing.</p>
        
        {error && <div className="login-error">{error}</div>}
        
        <form onSubmit={handleSubmit} className="login-form">
          <label>
            New Password
            <input 
              type="password" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              required 
              minLength={10}
            />
          </label>
          <label>
            Confirm New Password
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              required 
              minLength={10}
            />
          </label>
          <button type="submit" className="login-btn">Update Password</button>
        </form>
      </div>
    </div>
  );
}

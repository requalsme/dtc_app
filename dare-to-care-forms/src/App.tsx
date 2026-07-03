import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth, type Role } from './app/AuthContext';
import LoginPage from './app/LoginPage';
import SetupPage from './app/SetupPage';
import ChangePasswordPage from './app/ChangePasswordPage';
import AppShell from './app/AppShell';
import ProtectedRoute from './app/ProtectedRoute';
import CoursesPage from './app/CoursesPage';
import { CaregiverDashboard } from './features/caregiver/CaregiverDashboard';
// @ts-ignore
import { AdminApp } from './components/admin.jsx';
import { OfficeManagerApp } from './features/office-manager/OfficeManagerApp';
import NewHirePortal from './features/new-hire/NewHirePortal';
import ClientPortal from './features/client/ClientPortal';

import './styles/shell.css';
import './styles/desktop.css';
import './styles/wizard.css';

/* ===== Toast ===== */
function Toast({ msg, onClear }: { msg: string | null; onClear: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClear, 3000);
    return () => clearTimeout(t);
  }, [msg, onClear]);
  if (!msg) return null;
  return <div className="app-toast">{msg}</div>;
}

/* ===== Admin page router ===== */
function AdminRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [toast, setToast] = useState<string | null>(null);

  const segments = location.pathname.split('/').filter(Boolean);
  const page = segments[1] || 'dashboard';

  const onNav = useCallback((p: string) => {
    navigate(`/admin${p === 'dashboard' ? '' : '/' + p}`);
  }, [navigate]);

  return (
    <>
      <AdminApp page={page} onNav={onNav} onToast={setToast} />
      <Toast msg={toast} onClear={() => setToast(null)} />
    </>
  );
}

/* ===== Caregiver route ===== */
function CaregiverRoute() {
  const location = useLocation();
  const navigate = useNavigate();

  const segments = location.pathname.split('/').filter(Boolean);
  const page = segments[1] || 'today';

  const onNav = useCallback((p: string) => {
    navigate(`/caregiver${p === 'today' ? '' : '/' + p}`);
  }, [navigate]);

  return <CaregiverDashboard page={page} onNav={onNav} />;
}

/* ===== Office Manager page router ===== */
function OfficeManagerRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [toast, setToast] = useState<string | null>(null);

  const segments = location.pathname.split('/').filter(Boolean);
  const page = segments[1] || 'dashboard';

  const onNav = useCallback((p: string) => {
    navigate(`/office-manager${p === 'dashboard' ? '' : '/' + p}`);
  }, [navigate]);

  return (
    <>
      <OfficeManagerApp page={page} onNav={onNav} onToast={setToast} />
      <Toast msg={toast} onClear={() => setToast(null)} />
    </>
  );
}

/* ===== Root redirect based on role ===== */
function RoleRedirect() {
  const { user, isAuthenticated, isLoading, effectiveRole } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  const paths: Record<Role, string> = {
    admin: '/admin',
    caregiver: '/caregiver',
    officeManager: '/office-manager',
    newHire: '/new-hire',
    client: '/client',
  };
  const role = (effectiveRole ?? user.role) as Role;
  return <Navigate to={paths[role] || '/login'} replace />;
}

/* ===== Preview-aware protected route ===== */
function PreviewAwareRoute({ realRoles, previewRole, children }: { realRoles: Role[]; previewRole: Role; children: React.ReactNode }) {
  const { user, effectiveRole } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // Admin previewing this role gets access
  if (user.role === 'admin' && effectiveRole === previewRole) return <>{children}</>;
  // Real role check
  if (!realRoles.includes(user.role as Role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/* ===== Main app ===== */
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/" element={<RoleRedirect />} />

          {/* Courses (All Roles) */}
          <Route path="/courses" element={
            <ProtectedRoute allowedRoles={['admin', 'caregiver', 'officeManager']}>
              <AppShell><CoursesPage /></AppShell>
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppShell><AdminRoute /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppShell><AdminRoute /></AppShell>
            </ProtectedRoute>
          } />

          {/* Caregiver */}
          <Route path="/caregiver" element={
            <PreviewAwareRoute realRoles={['caregiver']} previewRole="caregiver">
              <AppShell><CaregiverRoute /></AppShell>
            </PreviewAwareRoute>
          } />
          <Route path="/caregiver/*" element={
            <PreviewAwareRoute realRoles={['caregiver']} previewRole="caregiver">
              <AppShell><CaregiverRoute /></AppShell>
            </PreviewAwareRoute>
          } />

          {/* Office Manager */}
          <Route path="/office-manager" element={
            <PreviewAwareRoute realRoles={['officeManager']} previewRole="officeManager">
              <AppShell><OfficeManagerRoute /></AppShell>
            </PreviewAwareRoute>
          } />
          <Route path="/office-manager/*" element={
            <PreviewAwareRoute realRoles={['officeManager']} previewRole="officeManager">
              <AppShell><OfficeManagerRoute /></AppShell>
            </PreviewAwareRoute>
          } />

          {/* New Hire */}
          <Route path="/new-hire" element={
            <PreviewAwareRoute realRoles={['newHire']} previewRole="newHire">
              <AppShell><NewHirePortal /></AppShell>
            </PreviewAwareRoute>
          } />
          <Route path="/new-hire/*" element={
            <PreviewAwareRoute realRoles={['newHire']} previewRole="newHire">
              <AppShell><NewHirePortal /></AppShell>
            </PreviewAwareRoute>
          } />

          {/* Client */}
          <Route path="/client" element={
            <PreviewAwareRoute realRoles={['client']} previewRole="client">
              <AppShell><ClientPortal /></AppShell>
            </PreviewAwareRoute>
          } />
          <Route path="/client/*" element={
            <PreviewAwareRoute realRoles={['client']} previewRole="client">
              <AppShell><ClientPortal /></AppShell>
            </PreviewAwareRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type Role } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

const homePaths: Record<Role, string> = {
  admin: '/admin',
  caregiver: '/caregiver',
  officeManager: '/office-manager',
  newHire: '/new-hire',
  client: '/client',
};

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="route-loading">
        <div className="route-loading-card">
          <span className="route-loading-mark" />
          <div>
            <strong>Restoring your workspace</strong>
            <span>Pulling your role, records, and pending work...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role as Role)) {
    return <Navigate to={homePaths[user.role as Role] || '/login'} replace />;
  }

  return <>{children}</>;
}

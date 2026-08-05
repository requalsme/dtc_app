import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Guards everything under /dev. Two separate facts both have to be true:
//   1. isDevMode  — this session actually came in through the dev login gate
//   2. devAccess  — the account is still allowed to (checked again here, not
//                    just trusted from login, so a revoked grant takes effect
//                    on the next navigation rather than waiting for sign-out)
//
// A caregiver with no dev grant who somehow lands on /dev — a bookmark, a
// shared link — gets bounced to their own ordinary portal, not to the login
// screen. There's nothing to explain; it's simply not a door for them.
export default function DevProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isDevMode } = useAuth();
  if (!user) return <Navigate to="/dev-login" replace />;
  if (!user.devAccess || !isDevMode) return <Navigate to="/" replace />;
  return <>{children}</>;
}

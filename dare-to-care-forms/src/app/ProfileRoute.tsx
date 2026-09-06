// Binds the profile screen to the signed-in user and the shell's own dialogs.
//
// Kept separate from ProfileScreen so that screen stays a plain component that
// takes a user and renders it — which is what makes it testable and what lets
// an admin previewing another role still see their real account rather than a
// pretend one.

import { useAuth } from "./AuthContext";
import { useShellActions } from "./AppShell";
// @ts-ignore - JSX module without types
import { ProfileScreen } from "../console/Profile.jsx";

export function ProfileRoute() {
  const { user } = useAuth();
  const { openLinkPhone } = useShellActions();
  return <ProfileScreen user={user} onLinkPhone={openLinkPhone} />;
}

export default ProfileRoute;

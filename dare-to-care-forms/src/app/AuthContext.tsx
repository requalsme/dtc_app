import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
// @ts-ignore - JS module without types
import { setStoredSession, clearStoredSession } from "./auth-storage.js";

export type Role = "admin" | "caregiver" | "officeManager" | "newHire" | "client";

export interface AppUser {
  id: string;
  name: string;
  initials: string;
  role: Role;
  email: string;
  phone?: string;
  status: string;
  mustChangePassword?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
  /** When admin is previewing another role, this is the true role */
  previewRole?: Role | null;
  // Separate from `role` on purpose. `role` is someone's real job — Raina's is
  // "caregiver," because that is genuinely the work Rushane assigns her. This
  // is a second, independent grant: does this person ALSO have owner-level
  // access to the dev portal. One person can be both. Only ever set by hand in
  // Firestore, never through the app, so it can't become self-service.
  devAccess?: boolean;
}

interface AuthContextValue {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  /** Same credentials as login(), but only succeeds if devAccess is set —
   *  otherwise it signs the account back out and refuses, so a login that
   *  doesn't qualify never lands anyone half-authenticated into the dev portal. */
  devLogin: (email: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  /** Admin-only: enter preview mode as another role */
  enterPreview: (role: Role) => void;
  exitPreview: () => void;
  /** The effective role (may differ from user.role when previewing) */
  effectiveRole: Role | null;
  /** True once someone has come in through the dev login gate this session. */
  isDevMode: boolean;
  /** Leave the dev portal and return to the person's real, ordinary portal —
   *  same account, same session, no re-login. */
  exitDevMode: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewRole, setPreviewRole] = useState<Role | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as Omit<AppUser, "id">;
            const appUser = { ...data, id: firebaseUser.uid };
            setUser(appUser);
            // Mirror the profile into local storage so non-React modules (schemas/store
            // `DTC.currentUser`) can resolve the signed-in caregiver reliably.
            setStoredSession({ user: appUser });
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
    
    if (userDoc.exists()) {
      const data = userDoc.data() as Omit<AppUser, "id">;
      const appUser = { ...data, id: userCredential.user.uid };
      setUser(appUser);
      setStoredSession({ user: appUser });
      return appUser;
    } else {
      throw new Error("User profile not found in database.");
    }
  };

  // Same credential check as login(), through a separate screen — this is the
  // "pop up a different login screen" entry Raina asked for, not a role
  // switch inside the app. It fails closed: if devAccess isn't set, the
  // session that Firebase just created is torn down immediately rather than
  // left signed in with nowhere to go. Whatever this account's real role is
  // (caregiver, office manager, whatever) is untouched by any of this.
  const devLogin = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

    if (!userDoc.exists()) {
      await signOut(auth);
      throw new Error("Account not recognized.");
    }
    const data = userDoc.data() as Omit<AppUser, "id">;
    if (!data.devAccess) {
      await signOut(auth);
      // Deliberately the same wording an unrecognized account would get. A
      // valid password on a non-dev account shouldn't confirm to whoever's
      // typing it that dev access is the specific thing missing.
      throw new Error("Account not recognized.");
    }
    const appUser = { ...data, id: userCredential.user.uid };
    setUser(appUser);
    setStoredSession({ user: appUser });
    setIsDevMode(true);
    return appUser;
  };

  const exitDevMode = () => setIsDevMode(false);

  const logout = async () => {
    await signOut(auth);
    clearStoredSession();
    setPreviewRole(null);
    setIsDevMode(false);
    setUser(null);
  };

  const enterPreview = (role: Role) => {
    if (user?.role === "admin") setPreviewRole(role);
  };

  const exitPreview = () => setPreviewRole(null);

  const effectiveRole = previewRole ?? user?.role ?? null;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoading, login, devLogin, logout, enterPreview, exitPreview, effectiveRole, isDevMode, exitDevMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

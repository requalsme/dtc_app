import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../config/supabase";
// @ts-ignore - JS module without types
import { fromRow } from "../lib/records.js";
// @ts-ignore - JS module without types
import { setStoredSession, clearStoredSession } from "./auth-storage.js";
// @ts-ignore - JS module without types
import { DTCStore } from "../components/store.js";

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
  // access to the dev portal. One person can be both. Never self-service: the
  // guard_dev_access trigger in Postgres rejects a self-write that changes this
  // field, so only an existing admin or dev can hand it out.
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

  // One place that turns an authenticated session into a profile, so the
  // listener and both login paths cannot drift apart in what they consider a
  // valid signed-in user.
  const loadProfile = async (userId: string): Promise<AppUser | null> => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return fromRow("users", data) as AppUser;
  };

  useEffect(() => {
    // Supabase fires the initial session through this same subscription, so
    // there is no separate "get the current session" path to keep in step.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const appUser = await loadProfile(session.user.id);
        setUser(appUser);
        if (appUser) {
          // Mirror the profile into local storage so non-React modules (schemas/store
          // `DTC.currentUser`) can resolve the signed-in caregiver reliably.
          setStoredSession({ user: appUser });
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const appUser = await loadProfile(data.user.id);
    if (!appUser) {
      // An auth account with no profile row cannot be placed in the app, so it
      // is signed back out rather than left half-authenticated.
      await supabase.auth.signOut();
      throw new Error("User profile not found in database.");
    }
    setUser(appUser);
    setStoredSession({ user: appUser });
    return appUser;
  };

  // Same credential check as login(), through a separate screen — this is the
  // "pop up a different login screen" entry Raina asked for, not a role
  // switch inside the app. It fails closed: if devAccess isn't set, the
  // session that was just created is torn down immediately rather than
  // left signed in with nowhere to go. Whatever this account's real role is
  // (caregiver, office manager, whatever) is untouched by any of this.
  const devLogin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Account not recognized.");

    const appUser = await loadProfile(data.user.id);
    if (!appUser || !appUser.devAccess) {
      await supabase.auth.signOut();
      // Deliberately the same wording an unrecognized account would get. A
      // valid password on a non-dev account shouldn't confirm to whoever's
      // typing it that dev access is the specific thing missing.
      throw new Error("Account not recognized.");
    }
    setUser(appUser);
    setStoredSession({ user: appUser });
    setIsDevMode(true);
    return appUser;
  };

  const exitDevMode = () => setIsDevMode(false);

  const logout = async () => {
    await supabase.auth.signOut();
    clearStoredSession();
    setPreviewRole(null);
    DTCStore.setPreviewMode(false);
    setIsDevMode(false);
    setUser(null);
  };

  // This is the actual safety boundary behind the "changes won't affect real
  // data" banner — see the matching comment on assertWritable() in store.js.
  // Every Store write method checks this flag before touching the database, so
  // the promise in the UI is enforced in one place rather than trusted at
  // each call site.
  const enterPreview = (role: Role) => {
    if (user?.role === "admin") {
      setPreviewRole(role);
      DTCStore.setPreviewMode(true);
    }
  };

  const exitPreview = () => {
    setPreviewRole(null);
    DTCStore.setPreviewMode(false);
  };

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

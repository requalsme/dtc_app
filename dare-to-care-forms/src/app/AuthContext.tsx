import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

export type Role = "admin" | "caregiver" | "officeManager" | "newHire" | "client";

export interface AppUser {
  id: string;
  name: string;
  initials: string;
  role: Role;
  email: string;
  status: string;
  mustChangePassword?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
  /** When admin is previewing another role, this is the true role */
  previewRole?: Role | null;
}

interface AuthContextValue {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  /** Admin-only: enter preview mode as another role */
  enterPreview: (role: Role) => void;
  exitPreview: () => void;
  /** The effective role (may differ from user.role when previewing) */
  effectiveRole: Role | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewRole, setPreviewRole] = useState<Role | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as Omit<AppUser, "id">;
            setUser({ ...data, id: firebaseUser.uid });
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
      return appUser;
    } else {
      throw new Error("User profile not found in database.");
    }
  };

  const logout = async () => {
    await signOut(auth);
    setPreviewRole(null);
    setUser(null);
  };

  const enterPreview = (role: Role) => {
    if (user?.role === "admin") setPreviewRole(role);
  };

  const exitPreview = () => setPreviewRole(null);

  const effectiveRole = previewRole ?? user?.role ?? null;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoading, login, logout, enterPreview, exitPreview, effectiveRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "./firebase-client";
import { db } from "./store";

type AuthState = { user: User | null; allowed: boolean; ready: boolean };
const Ctx = createContext<AuthState>({ user: null, allowed: false, ready: false });

/**
 * Firebase Auth session + admin check. Database rules only let users listed under /admins/{uid}
 * read or write, so a successful read of our own admin flag is the source of truth.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, allowed: false, ready: false });
  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) return setState({ user: null, allowed: false, ready: true });
        let allowed = false;
        try {
          allowed = (await db().ref(`admins/${user.uid}`).get()).val() === true;
        } catch {
          allowed = false;
        }
        setState({ user, allowed, ready: true });
      }),
    [],
  );
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const logout = () => signOut(auth);

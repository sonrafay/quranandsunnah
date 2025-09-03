// src/components/auth/AuthProvider.tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  User,
} from "firebase/auth";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state once for the whole app
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logOut = async () => {
    await fbSignOut(auth);
  };

  const value = useMemo(() => ({ user, loading, signInGoogle, logOut }), [user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider not mounted");
  return v;
}

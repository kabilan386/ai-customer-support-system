"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AuthState {
  token: string | null;
  role: string | null;
  name: string | null;
  userId: number | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, role: string, name: string, userId: number) => void;
  logout: () => void;
  ready: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadFromStorage(): AuthState {
  try {
    const stored = localStorage.getItem("auth");
    if (stored) return JSON.parse(stored);
  } catch {}
  return { token: null, role: null, name: null, userId: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ token: null, role: null, name: null, userId: null });
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setAuth(loadFromStorage());
    setReady(true);
  }, []);

  const login = (token: string, role: string, name: string, userId: number) => {
    const state = { token, role, name, userId };
    setAuth(state);
    localStorage.setItem("auth", JSON.stringify(state));
  };

  const logout = () => {
    setAuth({ token: null, role: null, name: null, userId: null });
    localStorage.removeItem("auth");
    router.push("/");
  };

  return <AuthContext.Provider value={{ ...auth, login, logout, ready }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

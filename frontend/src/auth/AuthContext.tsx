import { createContext, useContext, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setToken } from "../lib/api";
import type { User } from "../lib/types";

const USER_KEY = "ml_user";

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateStoredUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthState | null>(null);

function loadUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser());
  const queryClient = useQueryClient();

  function persist(u: User, token: string) {
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }

  const login: AuthState["login"] = async (email, password) => {
    const res = await api.login({ email, password });
    persist(res.user, res.token);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    queryClient.clear();
  };

  // Patch the in-memory + persisted user (e.g. clearing mustChangePassword
  // after a successful forced change) without a fresh login round-trip.
  const updateStoredUser: AuthState["updateStoredUser"] = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateStoredUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

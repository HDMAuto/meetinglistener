import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, loadToken, setToken } from "../lib/api";
import type { User } from "../lib/types";

const USER_KEY = "ml_user";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [token, rawUser] = await Promise.all([
        loadToken(),
        AsyncStorage.getItem(USER_KEY),
      ]);
      if (token && rawUser) setUser(JSON.parse(rawUser) as User);
      setReady(true);
    })();
  }, []);

  async function persist(u: User, token: string) {
    await setToken(token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }

  const login: AuthState["login"] = async (email, password) => {
    const res = await api.login({ email, password });
    await persist(res.user, res.token);
  };

  const register: AuthState["register"] = async (name, email, password) => {
    const res = await api.register({ name, email, password });
    await persist(res.user, res.token);
  };

  const logout = async () => {
    await setToken(null);
    await AsyncStorage.removeItem(USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

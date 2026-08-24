import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";

interface User {
  id: string;
  email: string;
}

export type LoginResult = { requiresTwoFactor: true; methods: string[] } | { requiresTwoFactor: false };

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  completeLogin: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<LoginResult> {
    const res = await api.post("/api/auth/login", { email, password });
    if (res.data.requiresTwoFactor) {
      return { requiresTwoFactor: true, methods: res.data.methods };
    }
    setUser(res.data);
    return { requiresTwoFactor: false };
  }

  async function register(email: string, password: string) {
    const res = await api.post("/api/auth/register", { email, password });
    setUser(res.data);
  }

  async function logout() {
    await api.post("/api/auth/logout");
    setUser(null);
  }

  function completeLogin(user: User) {
    setUser(user);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, completeLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

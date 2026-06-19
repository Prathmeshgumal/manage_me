import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { api, AUTH_UNAUTHORIZED_EVENT } from "@/lib/api";
import type { AuthUser } from "@/types";

type Status = "loading" | "authenticated" | "anonymous";

export type AuthContextValue = {
  status: Status;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const setAuthed = useCallback((u: AuthUser) => { setUser(u); setStatus("authenticated"); }, []);
  const setAnon = useCallback(() => { setUser(null); setStatus("anonymous"); }, []);

  useEffect(() => {
    api.get<{ user: AuthUser }>("/auth/me")
      .then((r) => setAuthed(r.user))
      .catch(() => setAnon());
  }, [setAuthed, setAnon]);

  useEffect(() => {
    const onUnauthorized = () => setAnon();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [setAnon]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ user: AuthUser }>("/auth/login", { email, password });
    setAuthed(r.user);
  }, [setAuthed]);

  const signup = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ user: AuthUser }>("/auth/signup", { email, password });
    setAuthed(r.user);
  }, [setAuthed]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout", {});
    setAnon();
  }, [setAnon]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post("/auth/change-password", { currentPassword, newPassword });
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, signup, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

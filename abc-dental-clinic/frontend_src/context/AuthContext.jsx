import { createContext, useContext, useEffect, useState } from "react";
import { api, setAuthHeader, formatApiError } from "@/api/client";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=guest, obj=user
  const [token, setToken] = useState(localStorage.getItem("access_token") || null);

  useEffect(() => {
    if (token) setAuthHeader(token);
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        setUser(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password, remember_me = false) => {
    try {
      const { data } = await api.post("/auth/login", { email, password, remember_me });
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        setToken(data.access_token);
        setAuthHeader(data.access_token);
      }
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("access_token");
    setAuthHeader(null);
    setUser(false);
    setToken(null);
  };

  return (
    <AuthCtx.Provider value={{ user, token, login, logout, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

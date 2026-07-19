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

  const [activeClinicId, setActiveClinicId] = useState(localStorage.getItem("active_clinic_id") || "");

  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        if (activeClinicId) {
          api.defaults.headers.common["X-Clinic-Id"] = activeClinicId;
          localStorage.setItem("active_clinic_id", activeClinicId);
        } else {
          delete api.defaults.headers.common["X-Clinic-Id"];
          localStorage.removeItem("active_clinic_id");
        }
      } else if (user.clinic_id) {
        api.defaults.headers.common["X-Clinic-Id"] = user.clinic_id;
        localStorage.removeItem("active_clinic_id");
      } else {
        delete api.defaults.headers.common["X-Clinic-Id"];
      }
    } else {
      delete api.defaults.headers.common["X-Clinic-Id"];
    }
  }, [user, activeClinicId]);

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
    localStorage.removeItem("active_clinic_id");
    setAuthHeader(null);
    delete api.defaults.headers.common["X-Clinic-Id"];
    setUser(false);
    setToken(null);
  };

  return (
    <AuthCtx.Provider value={{ user, token, login, logout, setUser, activeClinicId, setActiveClinicId }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

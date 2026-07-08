import { createContext, useContext, useEffect, useState } from "react";
import { portalApi, setPortalAuthHeader, formatApiError } from "@/api/client";

const PortalCtx = createContext(null);

export function PortalAuthProvider({ children }) {
  const [patient, setPatient] = useState(null); // null=checking, false=guest, obj=patient
  const [token, setToken] = useState(localStorage.getItem("portal_token") || null);

  useEffect(() => {
    if (token) setPortalAuthHeader(token);
    (async () => {
      try { const { data } = await portalApi.get("/portal/me"); setPatient(data); }
      catch { setPatient(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const _saveSession = (data) => {
    if (data.access_token) {
      localStorage.setItem("portal_token", data.access_token);
      setToken(data.access_token);
      setPortalAuthHeader(data.access_token);
    }
    setPatient(data.patient);
  };

  const signup = async (payload) => {
    try { const { data } = await portalApi.post("/portal/signup", payload); _saveSession(data); return { ok: true }; }
    catch (e) { return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message }; }
  };

  const login = async (email, password) => {
    try { const { data } = await portalApi.post("/portal/login", { email, password }); _saveSession(data); return { ok: true }; }
    catch (e) { return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message }; }
  };

  const logout = () => {
    localStorage.removeItem("portal_token");
    setPortalAuthHeader(null);
    setPatient(false);
    setToken(null);
  };

  return (
    <PortalCtx.Provider value={{ patient, token, signup, login, logout }}>
      {children}
    </PortalCtx.Provider>
  );
}

export const usePortal = () => useContext(PortalCtx);

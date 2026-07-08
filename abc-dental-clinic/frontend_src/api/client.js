import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Staff-side axios (Bearer token from localStorage)
export const api = axios.create({ baseURL: API, withCredentials: true });

export const setAuthHeader = (token) => {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
};

// Patient-portal axios (separate instance so cookies don't collide)
export const portalApi = axios.create({ baseURL: API, withCredentials: true });
export const setPortalAuthHeader = (token) => {
  if (token) portalApi.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete portalApi.defaults.headers.common["Authorization"];
};

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const API_BASE = API;

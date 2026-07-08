import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

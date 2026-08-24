import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  // Security questions are mandatory - if signup was interrupted before they were
  // set, force completion before anything else is reachable.
  if (!user.hasSecurityQuestions && location.pathname !== "/security-questions-setup") {
    return <Navigate to="/security-questions-setup" replace />;
  }

  return children;
}

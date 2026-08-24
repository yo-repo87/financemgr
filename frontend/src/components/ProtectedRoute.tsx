import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

// TEMPORARY: Auth bypass for preview — remove before production
const DEV_BYPASS_AUTH = true;

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthorized } = useAuth();

  if (DEV_BYPASS_AUTH) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAuthorized) return <Navigate to="/access-denied" replace />;

  return <>{children}</>;
}

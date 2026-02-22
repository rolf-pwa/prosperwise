import { signInWithGoogle } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { isAllowedDomain } from "@/lib/auth";

const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const Login = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary">
        <div className="animate-pulse text-primary-foreground">Loading...</div>
      </div>
    );
  }

  // If already signed in, route based on domain
  if (user) {
    if (isAllowedDomain(user.email)) return <Navigate to="/dashboard" replace />;
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary">
      <div className="mx-4 w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
            <Shield className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground">
            Sovereignty CRM
          </h1>
          <p className="text-sm text-primary-foreground/60">
            ProsperWise Advisors — Secure Access
          </p>
        </div>

        <div className="rounded-lg border border-primary-foreground/10 bg-primary-foreground/5 p-8 backdrop-blur">
          <p className="mb-6 text-sm text-primary-foreground/70">
            Sign in with your Google account to continue.
          </p>
          <Button
            onClick={() => signInWithGoogle()}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            size="lg"
          >
            <GoogleIcon />
            Sign in with Google
          </Button>
          <p className="mt-4 text-xs text-primary-foreground/40">
            Advisors: @prosperwise.ca · Clients: your email on file
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

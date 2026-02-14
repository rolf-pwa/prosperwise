import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Handles the OAuth callback at the root URL.
 * When the OAuth broker redirects back with hash params (#access_token=...),
 * this component waits for Supabase to process the tokens before redirecting.
 * If there are no hash params, it immediately redirects to /dashboard.
 */
const AuthCallback = () => {
  const [ready, setReady] = useState(false);
  const hasAuthHash = window.location.hash?.includes("access_token");

  useEffect(() => {
    if (!hasAuthHash) {
      setReady(true);
      return;
    }

    // Wait for Supabase to process the hash tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          setReady(true);
        }
      }
    );

    // Fallback timeout in case the event never fires
    const timeout = setTimeout(() => setReady(true), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [hasAuthHash]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary">
        <div className="animate-pulse text-primary-foreground">Signing in...</div>
      </div>
    );
  }

  return <Navigate to="/dashboard" replace />;
};

export default AuthCallback;

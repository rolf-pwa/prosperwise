import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const ALLOWED_DOMAIN = "prosperwise.ca";

export async function signInWithGoogle() {
  // Detect if we're on a published/custom domain vs Lovable preview
  const isLovablePreview =
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("id-preview");

  if (isLovablePreview) {
    // Use Lovable auth bridge for preview environments
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: {
        hd: "prosperwise.ca",
        prompt: "select_account",
      },
    });
    return result;
  } else {
    // For published/custom domains, bypass auth bridge
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true,
        queryParams: {
          hd: "prosperwise.ca",
          prompt: "select_account",
        },
      },
    });

    if (error) return { error };

    if (data?.url) {
      window.location.href = data.url;
    }

    return { error: null };
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export function isAllowedDomain(email: string | undefined): boolean {
  if (!email) return false;
  return email.endsWith(`@${ALLOWED_DOMAIN}`);
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

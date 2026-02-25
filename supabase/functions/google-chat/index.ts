import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

async function getValidAccessToken(supabaseAdmin: any, userId: string): Promise<string> {
  const { data: tokenRow, error } = await supabaseAdmin
    .from("google_tokens")
    .select("access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tokenRow) throw new Error("Google not connected");

  // Check if token is expired (with 60s buffer)
  if (new Date(tokenRow.token_expiry).getTime() - 60_000 < Date.now()) {
    // Refresh
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokenRow.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokens = await res.json();
    if (tokens.error) throw new Error(`Token refresh failed: ${tokens.error}`);

    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("google_tokens")
      .update({ access_token: tokens.access_token, token_expiry: newExpiry })
      .eq("user_id", userId);

    return tokens.access_token;
  }

  return tokenRow.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const accessToken = await getValidAccessToken(supabaseAdmin, userId);
    const gHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    // --- List Spaces ---
    if (action === "list-spaces") {
      const pageSize = url.searchParams.get("pageSize") || "50";
      const pageToken = url.searchParams.get("pageToken") || "";
      const params = new URLSearchParams({ pageSize });
      if (pageToken) params.set("pageToken", pageToken);

      const res = await fetch(
        `https://chat.googleapis.com/v1/spaces?${params}`,
        { headers: gHeaders }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- List Messages in a Space ---
    if (action === "list-messages") {
      const spaceName = url.searchParams.get("space");
      if (!spaceName) throw new Error("Missing 'space' parameter");

      const pageSize = url.searchParams.get("pageSize") || "25";
      const pageToken = url.searchParams.get("pageToken") || "";
      const params = new URLSearchParams({ pageSize, orderBy: "createTime desc" });
      if (pageToken) params.set("pageToken", pageToken);

      const res = await fetch(
        `https://chat.googleapis.com/v1/${spaceName}/messages?${params}`,
        { headers: gHeaders }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Send Message ---
    if (action === "send-message") {
      const { space, text } = await req.json();
      if (!space || !text) throw new Error("Missing 'space' or 'text'");

      const res = await fetch(
        `https://chat.googleapis.com/v1/${space}/messages`,
        {
          method: "POST",
          headers: gHeaders,
          body: JSON.stringify({ text }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Get Space Details ---
    if (action === "get-space") {
      const spaceName = url.searchParams.get("space");
      if (!spaceName) throw new Error("Missing 'space' parameter");

      const res = await fetch(
        `https://chat.googleapis.com/v1/${spaceName}`,
        { headers: gHeaders }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- List Members of a Space ---
    if (action === "list-members") {
      const spaceName = url.searchParams.get("space");
      if (!spaceName) throw new Error("Missing 'space' parameter");

      const res = await fetch(
        `https://chat.googleapis.com/v1/${spaceName}/members`,
        { headers: gHeaders }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Resolve member names via Workspace Directory API ---
    if (action === "resolve-members") {
      const { memberIds } = await req.json();
      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return new Response(JSON.stringify({ resolved: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resolved: Record<string, string> = {};

      // memberIds are like "users/123456" — use Directory API to look up names
      await Promise.allSettled(
        memberIds.map(async (memberId: string) => {
          try {
            const userId = memberId.replace("users/", "");
            // Try People API with directory source
            const res = await fetch(
              `https://people.googleapis.com/v1/people/${userId}?personFields=names&sources=DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE`,
              { headers: gHeaders }
            );
            if (res.ok) {
              const person = await res.json();
              const name = person.names?.[0]?.displayName;
              if (name) {
                resolved[memberId] = name;
                return;
              }
            }
            // Fallback: try Admin Directory API
            const adminRes = await fetch(
              `https://admin.googleapis.com/admin/directory/v1/users/${userId}`,
              { headers: gHeaders }
            );
            if (adminRes.ok) {
              const user = await adminRes.json();
              const name = user.name?.fullName;
              if (name) {
                resolved[memberId] = name;
                return;
              }
            }
            console.log(`Could not resolve ${memberId}: People=${res.status}, Admin=${adminRes.status}`);
          } catch (e) {
            console.error(`Error resolving ${memberId}:`, e);
          }
        })
      );

      return new Response(JSON.stringify({ resolved }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

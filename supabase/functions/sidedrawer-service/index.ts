import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://prosperwise.lovable.app",
  "https://id-preview--339dfc8f-3e82-4b05-8a36-a9f66fc58449.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// SideDrawer Tenant Gateway (CA region for PIPEDA)
const SD_BASE_URL = Deno.env.get("SIDEDRAWER_BASE_URL") || "https://api.ca.sidedrawer.com";
const SD_CLIENT_ID = Deno.env.get("SIDEDRAWER_CLIENT_ID");
const SD_CLIENT_SECRET = Deno.env.get("SIDEDRAWER_CLIENT_SECRET");
const SD_TENANT_ID = Deno.env.get("SIDEDRAWER_TENANT_ID");

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  if (!SD_CLIENT_ID || !SD_CLIENT_SECRET) {
    throw new Error("SideDrawer credentials not configured. Add SIDEDRAWER_CLIENT_ID and SIDEDRAWER_CLIENT_SECRET.");
  }

  const tokenRes = await fetch(`${SD_BASE_URL}/api/v2/auth/tenant-gateway/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: SD_CLIENT_ID,
      client_secret: SD_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`SideDrawer auth failed [${tokenRes.status}]: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
  };
  return cachedToken.token;
}

async function sdFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(SD_TENANT_ID ? { "x-tenant-id": SD_TENANT_ID } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };
  return fetch(`${SD_BASE_URL}${path}`, { ...options, headers });
}

// Extract SideDrawer record ID from a sidedrawer_url
function extractRecordId(sidedrawerUrl: string): string | null {
  // Pattern: https://prosperwise.sidedrawer.com/sidedrawer/<id>
  const match = sidedrawerUrl.match(/sidedrawer\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Domain verification: only @prosperwise.ca staff can access SideDrawer
    if (!user.email?.toLowerCase().endsWith("@prosperwise.ca")) {
      console.warn(`[SideDrawer] Domain check failed for ${user.email}`);
      return new Response(JSON.stringify({ error: "Access denied: unauthorized domain" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, sidedrawerUrl, ...params } = body;

    // Check credentials are configured
    if (!SD_CLIENT_ID || !SD_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({
          error: "SideDrawer credentials not configured",
          message: "Please add SIDEDRAWER_CLIENT_ID, SIDEDRAWER_CLIENT_SECRET, SIDEDRAWER_TENANT_ID, and SIDEDRAWER_BASE_URL as secrets.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: any;

    switch (action) {
      // ── Browse: list drawers / folders / records ──
      case "getRecord": {
        const recordId = extractRecordId(sidedrawerUrl) || params.recordId;
        if (!recordId) throw new Error("No SideDrawer record ID found");
        const res = await sdFetch(`/api/v2/sidedrawer/${recordId}`);
        if (!res.ok) throw new Error(`getRecord failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      case "listDrawers": {
        const recordId = extractRecordId(sidedrawerUrl) || params.recordId;
        if (!recordId) throw new Error("No SideDrawer record ID found");
        const res = await sdFetch(`/api/v2/sidedrawer/${recordId}/records`);
        if (!res.ok) throw new Error(`listDrawers failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      case "listFiles": {
        const recordId = extractRecordId(sidedrawerUrl) || params.recordId;
        const drawerId = params.drawerId;
        if (!recordId || !drawerId) throw new Error("recordId and drawerId required");
        const res = await sdFetch(`/api/v2/sidedrawer/${recordId}/records/${drawerId}/files`);
        if (!res.ok) throw new Error(`listFiles failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      // ── Upload ──
      case "getUploadUrl": {
        const recordId = extractRecordId(sidedrawerUrl) || params.recordId;
        const drawerId = params.drawerId;
        const fileName = params.fileName;
        if (!recordId || !drawerId || !fileName) throw new Error("recordId, drawerId, fileName required");
        const res = await sdFetch(
          `/api/v2/sidedrawer/${recordId}/records/${drawerId}/files/upload-url`,
          {
            method: "POST",
            body: JSON.stringify({ file_name: fileName }),
          }
        );
        if (!res.ok) throw new Error(`getUploadUrl failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      // ── Provision new SideDrawer ──
      case "createSideDrawer": {
        const { name, ownerEmail } = params;
        if (!name) throw new Error("name required for provisioning");
        const res = await sdFetch(`/api/v2/sidedrawer`, {
          method: "POST",
          body: JSON.stringify({
            name,
            owner_email: ownerEmail || undefined,
          }),
        });
        if (!res.ok) throw new Error(`createSideDrawer failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      // ── Collaborators ──
      case "addCollaborator": {
        const recordId = extractRecordId(sidedrawerUrl) || params.recordId;
        const { email, role } = params;
        if (!recordId || !email) throw new Error("recordId and email required");
        const res = await sdFetch(`/api/v2/sidedrawer/${recordId}/collaborators`, {
          method: "POST",
          body: JSON.stringify({ email, role: role || "viewer" }),
        });
        if (!res.ok) throw new Error(`addCollaborator failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      case "listCollaborators": {
        const recordId = extractRecordId(sidedrawerUrl) || params.recordId;
        if (!recordId) throw new Error("recordId required");
        const res = await sdFetch(`/api/v2/sidedrawer/${recordId}/collaborators`);
        if (!res.ok) throw new Error(`listCollaborators failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("SideDrawer service error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

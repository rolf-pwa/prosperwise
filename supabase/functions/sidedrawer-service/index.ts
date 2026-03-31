import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://prosperwise.lovable.app",
  "https://app.prosperwise.ca",
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

// SideDrawer config
const SD_BASE_URL = Deno.env.get("SIDEDRAWER_BASE_URL") || "https://api-sbx.sidedrawersbx.com";
const SD_CLIENT_ID = Deno.env.get("SIDEDRAWER_CLIENT_ID");
const SD_CLIENT_SECRET = Deno.env.get("SIDEDRAWER_CLIENT_SECRET");
const SD_TENANT_ID = Deno.env.get("SIDEDRAWER_TENANT_ID");

// Derive tenant gateway URL from base URL (e.g. api-sbx.sidedrawersbx.com → tenants-gateway-api-sbx.sidedrawersbx.com)
function getTenantGatewayUrl(): string {
  try {
    const url = new URL(SD_BASE_URL);
    // Replace "api" prefix with "tenants-gateway-api" in hostname
    url.hostname = url.hostname.replace(/^api/, "tenants-gateway-api");
    return url.origin;
  } catch {
    return "https://tenants-gateway-api-sbx.sidedrawersbx.com";
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  if (!SD_CLIENT_ID || !SD_CLIENT_SECRET || !SD_TENANT_ID) {
    throw new Error("SideDrawer credentials not configured. Add SIDEDRAWER_CLIENT_ID, SIDEDRAWER_CLIENT_SECRET, and SIDEDRAWER_TENANT_ID.");
  }

  const gatewayUrl = getTenantGatewayUrl();
  const tokenUrl = `${gatewayUrl}/api/v1/developers/tenant/tenant-id/${SD_TENANT_ID}/applications/client-id/${SD_CLIENT_ID}/developer-login`;

  console.log(`[SideDrawer] Requesting token from: ${tokenUrl}`);

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientSecret: SD_CLIENT_SECRET }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`SideDrawer auth failed [${tokenRes.status}]: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token || tokenData.token || tokenData.accessToken;
  if (!accessToken) {
    throw new Error(`SideDrawer auth: no token in response: ${JSON.stringify(tokenData).substring(0, 200)}`);
  }

  cachedToken = {
    token: accessToken,
    expiresAt: Date.now() + (tokenData.expires_in || tokenData.expiresIn || 3600) * 1000,
  };
  return cachedToken.token;
}

async function sdFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  return fetch(`${SD_BASE_URL}${path}`, { ...options, headers });
}

// Extract SideDrawer record ID from a sidedrawer_url
function extractRecordId(sidedrawerUrl: string): string | null {
  // Pattern: https://prosperwise.sidedrawer.com/core/home/<id>/...
  const match = sidedrawerUrl.match(/(?:sidedrawer|home)\/([a-f0-9]{24})/);
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
    if (!user.email?.toLowerCase().endsWith("@prosperwise.ca")) {
      return new Response(JSON.stringify({ error: "Access denied: unauthorized domain" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, sidedrawerUrl, ...params } = body;

    if (!SD_CLIENT_ID || !SD_CLIENT_SECRET || !SD_TENANT_ID) {
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
      // ── Get drawer info ──
      case "getRecord": {
        const sdId = extractRecordId(sidedrawerUrl) || params.recordId;
        if (!sdId) throw new Error("No SideDrawer ID found");
        const res = await sdFetch(`/api/v1/records/sidedrawer/sidedrawer-id/${sdId}`);
        if (!res.ok) throw new Error(`getRecord failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      // ── List folders (records) in a drawer ──
      case "listDrawers":
      case "listFolders": {
        const sdId = extractRecordId(sidedrawerUrl) || params.recordId;
        if (!sdId) throw new Error("No SideDrawer ID found");
        const res = await sdFetch(`/api/v1/records/sidedrawer/sidedrawer-id/${sdId}/records`);
        if (!res.ok) throw new Error(`listFolders failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      // ── List files in a folder ──
      case "listFiles": {
        const sdId = extractRecordId(sidedrawerUrl) || params.recordId;
        const folderId = params.folderId || params.drawerId;
        if (!sdId || !folderId) throw new Error("sidedrawerId and folderId required");
        const res = await sdFetch(`/api/v2/record-files/sidedrawer/sidedrawer-id/${sdId}/records/record-id/${folderId}/record-files`);
        if (!res.ok) throw new Error(`listFiles failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      // ── Upload file to a folder ──
      case "uploadFile": {
        const sdId = extractRecordId(sidedrawerUrl) || params.recordId;
        const folderId = params.folderId || params.drawerId;
        const fileName = params.fileName;
        const fileContent = params.fileContent; // base64 encoded
        if (!sdId || !folderId || !fileName) throw new Error("sidedrawerId, folderId, and fileName required");

        const token = await getAccessToken();
        const formData = new FormData();

        if (fileContent) {
          // Decode base64 file content
          const binaryStr = atob(fileContent);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: "application/pdf" });
          formData.append("file", blob, fileName);
        }

        const uploadUrl = `${SD_BASE_URL}/api/v2/record-files/sidedrawer/sidedrawer-id/${sdId}/records/record-id/${folderId}/record-files`;
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        if (!res.ok) throw new Error(`uploadFile failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      // ── Provision new SideDrawer ──
      case "createSideDrawer": {
        const { name, ownerEmail } = params;
        if (!name) throw new Error("name required for provisioning");
        const res = await sdFetch(`/api/v1/records/sidedrawer`, {
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
        const sdId = extractRecordId(sidedrawerUrl) || params.recordId;
        const { email, role } = params;
        if (!sdId || !email) throw new Error("sidedrawerId and email required");
        const res = await sdFetch(`/api/v1/records/sidedrawer/sidedrawer-id/${sdId}/collaborators`, {
          method: "POST",
          body: JSON.stringify({ email, role: role || "viewer" }),
        });
        if (!res.ok) throw new Error(`addCollaborator failed [${res.status}]: ${await res.text()}`);
        result = await res.json();
        break;
      }

      case "listCollaborators": {
        const sdId = extractRecordId(sidedrawerUrl) || params.recordId;
        if (!sdId) throw new Error("sidedrawerId required");
        const res = await sdFetch(`/api/v1/records/sidedrawer/sidedrawer-id/${sdId}/collaborators`);
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

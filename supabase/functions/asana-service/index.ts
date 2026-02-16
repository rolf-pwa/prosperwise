import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASANA_BASE_URL = "https://app.asana.com/api/1.0";

// ---------------------------------------------------------------------------
// Fail-safe wrapper with placeholder exponential backoff
// ---------------------------------------------------------------------------
async function withFailSafe<T>(
  label: string,
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        console.error(`[AsanaService] ${label} failed after ${maxRetries} attempts:`, err);
        throw err;
      }
      const backoffMs = Math.min(1000 * 2 ** attempt, 16000);
      console.warn(
        `[AsanaService] ${label} attempt ${attempt} failed, retrying in ${backoffMs}ms...`,
      );
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

// ---------------------------------------------------------------------------
// AsanaService – centralised module for Asana API communication
// ---------------------------------------------------------------------------
class AsanaService {
  private token: string;
  private workspaceId: string;
  private projectTemplateId: string;

  constructor() {
    const token = Deno.env.get("ASANA_ACCESS_TOKEN");
    if (!token) throw new Error("ASANA_ACCESS_TOKEN is not configured");

    const workspaceId = Deno.env.get("ASANA_WORKSPACE_ID");
    if (!workspaceId) throw new Error("ASANA_WORKSPACE_ID is not configured");

    const projectTemplateId = Deno.env.get("ASANA_PROJECT_TEMPLATE_ID");
    if (!projectTemplateId) throw new Error("ASANA_PROJECT_TEMPLATE_ID is not configured");

    this.token = token;
    this.workspaceId = workspaceId;
    this.projectTemplateId = projectTemplateId;
  }

  // --- headers (never exposed to client) ---
  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  // -------------------------------------------------------------------------
  // createTask – PLACEHOLDER (no live API call)
  // -------------------------------------------------------------------------
  async createTask(payload: {
    name: string;
    notes?: string;
    due_on?: string;
    projects?: string;
  }) {
    return withFailSafe("createTask", async () => {
      console.log("[AsanaService] createTask called with:", JSON.stringify(payload));
      console.log("[AsanaService] Would POST to:", `${ASANA_BASE_URL}/tasks`);
      console.log("[AsanaService] Headers prepared (Bearer token attached on backend)");
      console.log("[AsanaService] Workspace:", this.workspaceId);
      console.log("[AsanaService] Template:", this.projectTemplateId);

      // Placeholder – no live call
      return {
        status: "Infrastructure Ready",
        method: "createTask",
        payload_received: payload,
      };
    });
  }

  // -------------------------------------------------------------------------
  // getProjectStatus – PLACEHOLDER (no live API call)
  // -------------------------------------------------------------------------
  async getProjectStatus(payload: { project_gid: string }) {
    return withFailSafe("getProjectStatus", async () => {
      console.log("[AsanaService] getProjectStatus called with:", JSON.stringify(payload));
      console.log("[AsanaService] Would GET:", `${ASANA_BASE_URL}/projects/${payload.project_gid}/tasks`);
      console.log("[AsanaService] Headers prepared (Bearer token attached on backend)");

      // Placeholder – no live call
      return {
        status: "Infrastructure Ready",
        method: "getProjectStatus",
        payload_received: payload,
      };
    });
  }
}

// ---------------------------------------------------------------------------
// Edge function handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All PII in body, never in URI
    const body = await req.json();
    const { action, ...params } = body;

    const service = new AsanaService();

    let result: unknown;
    switch (action) {
      case "createTask":
        result = await service.createTask(params);
        break;
      case "getProjectStatus":
        result = await service.getProjectStatus(params);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[AsanaService] Unhandled error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

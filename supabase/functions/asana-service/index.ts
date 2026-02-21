import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASANA_BASE_URL = "https://app.asana.com/api/1.0";

// ---------------------------------------------------------------------------
// Fail-safe wrapper with exponential backoff
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
// Helper: Extract Asana project GID from an asana_url
// e.g. https://app.asana.com/0/1234567890/list → "1234567890"
// ---------------------------------------------------------------------------
function extractProjectGid(asanaUrl: string | null): string | null {
  if (!asanaUrl) return null;
  // Match both old format (/0/PROJECT_GID) and new format (/project/PROJECT_GID)
  const newMatch = asanaUrl.match(/\/project\/(\d+)/);
  if (newMatch) return newMatch[1];
  const oldMatch = asanaUrl.match(/app\.asana\.com\/0\/(\d+)/);
  return oldMatch ? oldMatch[1] : null;
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
      return {
        status: "Infrastructure Ready",
        method: "getProjectStatus",
        payload_received: payload,
      };
    });
  }

  // -------------------------------------------------------------------------
  // getTasksForProject – LIVE: Fetch tasks from an Asana project
  // -------------------------------------------------------------------------
  async getTasksForProject(projectGid: string) {
    return withFailSafe("getTasksForProject", async () => {
      const url = `${ASANA_BASE_URL}/projects/${projectGid}/tasks?opt_fields=name,completed,due_on,assignee_status,custom_fields,memberships.section.name,followers,notes&limit=100`;
      console.log("[AsanaService] GET", url);

      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Asana API error ${res.status}: ${body}`);
      }
      const json = await res.json();
      return json.data || [];
    });
  }

  // -------------------------------------------------------------------------
  // getTaskStories – LIVE: Fetch comments/stories for a task
  // -------------------------------------------------------------------------
  async getTaskStories(taskGid: string) {
    return withFailSafe("getTaskStories", async () => {
      const url = `${ASANA_BASE_URL}/tasks/${taskGid}/stories?opt_fields=text,created_by.name,created_at,type,resource_subtype`;
      console.log("[AsanaService] GET", url);

      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Asana API error ${res.status}: ${body}`);
      }
      const json = await res.json();
      // Only return comment-type stories
      return (json.data || []).filter(
        (s: any) => s.resource_subtype === "comment_added",
      );
    });
  }

  // -------------------------------------------------------------------------
  // postTaskComment – LIVE: Post a comment to an Asana task
  // -------------------------------------------------------------------------
  async postTaskComment(taskGid: string, text: string) {
    return withFailSafe("postTaskComment", async () => {
      const url = `${ASANA_BASE_URL}/tasks/${taskGid}/stories`;
      console.log("[AsanaService] POST comment to", url);

      const res = await fetch(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ data: { text } }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Asana API error ${res.status}: ${body}`);
      }
      return await res.json();
    });
  }

  // -------------------------------------------------------------------------
  // getDashboardTasks – LIVE: Fetch tasks from workspace where user is assignee/follower
  // Uses workspace-level task search with due_on = today
  // -------------------------------------------------------------------------
  async getDashboardTasks() {
    return withFailSafe("getDashboardTasks", async () => {
      const today = new Date().toISOString().split("T")[0];
      const url = `${ASANA_BASE_URL}/workspaces/${this.workspaceId}/tasks/search?opt_fields=name,completed,due_on,memberships.section.name,memberships.project.gid,followers,notes&due_on.before=${today}&due_on.after=2000-01-01&is_subtask=false&completed=false&limit=50`;
      console.log("[AsanaService] GET dashboard tasks");

      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Asana API error ${res.status}: ${body}`);
      }
      const json = await res.json();
      return json.data || [];
    });
  }

  // -------------------------------------------------------------------------
  // getInbox – LIVE: Fetch all tasks assigned to OR followed by the user
  // Merges both sets, deduplicates, and sorts by modified_at descending
  // -------------------------------------------------------------------------
  async getInbox() {
    return withFailSafe("getInbox", async () => {
      const fields = "name,completed,due_on,modified_at,memberships.section.name,memberships.project.gid,notes,num_subtasks";

      // Two parallel searches: assigned to me + followed by me
      const assignedUrl = `${ASANA_BASE_URL}/workspaces/${this.workspaceId}/tasks/search?opt_fields=${fields}&assignee.any=me&is_subtask=false&completed=false&sort_by=modified_at&sort_ascending=false&limit=50`;
      const followedUrl = `${ASANA_BASE_URL}/workspaces/${this.workspaceId}/tasks/search?opt_fields=${fields}&followers.any=me&is_subtask=false&completed=false&sort_by=modified_at&sort_ascending=false&limit=50`;

      console.log("[AsanaService] GET inbox (assigned + followed)");

      const [assignedRes, followedRes] = await Promise.all([
        fetch(assignedUrl, { headers: this.headers() }),
        fetch(followedUrl, { headers: this.headers() }),
      ]);

      if (!assignedRes.ok) {
        const body = await assignedRes.text();
        throw new Error(`Asana API error (assigned) ${assignedRes.status}: ${body}`);
      }
      if (!followedRes.ok) {
        const body = await followedRes.text();
        throw new Error(`Asana API error (followed) ${followedRes.status}: ${body}`);
      }

      const [assignedJson, followedJson] = await Promise.all([
        assignedRes.json(),
        followedRes.json(),
      ]);

      // Merge & deduplicate by GID
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const task of [...(assignedJson.data || []), ...(followedJson.data || [])]) {
        if (!seen.has(task.gid)) {
          seen.add(task.gid);
          merged.push(task);
        }
      }

      // Sort by modified_at descending
      merged.sort((a, b) => {
        const da = a.modified_at ? new Date(a.modified_at).getTime() : 0;
        const db = b.modified_at ? new Date(b.modified_at).getTime() : 0;
        return db - da;
      });

      return merged.slice(0, 50);
    });
  }

  // -------------------------------------------------------------------------
  // verifyTaskBelongsToProject – Privacy guardrail
  // -------------------------------------------------------------------------
  async verifyTaskBelongsToProject(taskGid: string, projectGid: string): Promise<boolean> {
    return withFailSafe("verifyTaskBelongsToProject", async () => {
      const url = `${ASANA_BASE_URL}/tasks/${taskGid}?opt_fields=memberships.project.gid`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return false;
      const json = await res.json();
      const memberships = json.data?.memberships || [];
      return memberships.some((m: any) => m.project?.gid === projectGid);
    });
  }
}

// ---------------------------------------------------------------------------
// Portal token validation helper
// ---------------------------------------------------------------------------
async function validatePortalToken(
  portalToken: string,
): Promise<{ contactId: string; asanaProjectGid: string | null } | null> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: tokenData, error } = await supabase
    .from("portal_tokens")
    .select("contact_id, expires_at, revoked")
    .eq("token", portalToken)
    .eq("revoked", false)
    .maybeSingle();

  if (error || !tokenData) return null;
  if (new Date(tokenData.expires_at) < new Date()) return null;

  // Get the contact's asana_url to extract the project GID
  const { data: contact } = await supabase
    .from("contacts")
    .select("asana_url")
    .eq("id", tokenData.contact_id)
    .maybeSingle();

  const asanaProjectGid = extractProjectGid(contact?.asana_url || null);

  return { contactId: tokenData.contact_id, asanaProjectGid };
}

// ---------------------------------------------------------------------------
// Edge function handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, portal_token, ...params } = body;

    // ---- Auth: either Supabase Bearer or portal_token ----
    let portalContext: { contactId: string; asanaProjectGid: string | null } | null = null;

    if (portal_token) {
      portalContext = await validatePortalToken(portal_token);
      if (!portalContext) {
        return new Response(JSON.stringify({ error: "Invalid or expired portal token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Supabase auth path
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
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const service = new AsanaService();
    let result: unknown;

    switch (action) {
      case "createTask":
        result = await service.createTask(params as any);
        break;

      case "getProjectStatus":
        result = await service.getProjectStatus(params as any);
        break;

      case "getTasksForProject": {
        // Portal path: use the project GID from the contact's asana_url
        const projectGid = portalContext?.asanaProjectGid || params.project_gid;
        if (!projectGid) {
          return new Response(
            JSON.stringify({ error: "No Asana project configured for this contact" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const allTasks = await service.getTasksForProject(projectGid);

        // Portal users only see tasks marked "Client Visible" via Asana custom field
        if (portalContext) {
          const visibleTasks = (allTasks as any[]).filter((task: any) => {
            const customFields = task.custom_fields || [];
            return customFields.some(
              (cf: any) =>
                cf.name?.toLowerCase().includes("client visible") &&
                (cf.display_value === "Yes" || cf.enum_value?.name === "Yes" || cf.display_value === "true" || cf.number_value === 1 || cf.type === "enum" && cf.enum_value?.name?.toLowerCase() === "yes"),
            );
          });
          result = visibleTasks;
        } else {
          result = allTasks;
        }
        break;
      }

      case "getTaskStories": {
        const { task_gid } = params;
        if (!task_gid) {
          return new Response(
            JSON.stringify({ error: "task_gid is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Privacy guardrail: if portal, verify task belongs to the contact's project
        if (portalContext) {
          if (!portalContext.asanaProjectGid) {
            return new Response(
              JSON.stringify({ error: "No Asana project configured" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          const belongs = await service.verifyTaskBelongsToProject(task_gid, portalContext.asanaProjectGid);
          if (!belongs) {
            return new Response(
              JSON.stringify({ error: "Access denied: task does not belong to your project" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
        result = await service.getTaskStories(task_gid);
        break;
      }

      case "postTaskComment": {
        const { task_gid: tGid, text } = params;
        if (!tGid || !text) {
          return new Response(
            JSON.stringify({ error: "task_gid and text are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Privacy guardrail
        if (portalContext) {
          if (!portalContext.asanaProjectGid) {
            return new Response(
              JSON.stringify({ error: "No Asana project configured" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          const belongs = await service.verifyTaskBelongsToProject(tGid, portalContext.asanaProjectGid);
          if (!belongs) {
            return new Response(
              JSON.stringify({ error: "Access denied: task does not belong to your project" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
        result = await service.postTaskComment(tGid, text);
        break;
      }

      case "getDashboardTasks": {
        result = await service.getDashboardTasks();
        break;
      }

      case "getInbox": {
        result = await service.getInbox();
        break;
      }

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

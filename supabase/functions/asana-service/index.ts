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
  // New format: /1/WORKSPACE/project/PROJECT_GID/...
  const newMatch = asanaUrl.match(/\/project\/(\d+)/);
  if (newMatch) return newMatch[1];
  // Old format: /0/PROJECT_GID
  const oldMatch = asanaUrl.match(/app\.asana\.com\/0\/(\d+)/);
  return oldMatch ? oldMatch[1] : null;
}

// ---------------------------------------------------------------------------
// Helper: Extract Asana task GID from a task URL
// Supports:
//   https://app.asana.com/0/PROJECT_GID/TASK_GID       → TASK_GID
//   https://app.asana.com/0/PROJECT_GID/TASK_GID/f     → TASK_GID
//   https://app.asana.com/0/TASK_GID/f                 → TASK_GID
// ---------------------------------------------------------------------------
function extractTaskGid(asanaUrl: string | null): string | null {
  if (!asanaUrl) return null;
  // New format: /task/TASK_GID
  const newTaskMatch = asanaUrl.match(/\/task\/(\d+)/);
  if (newTaskMatch) return newTaskMatch[1];
  // New format: /project/PROJECT/list/TASK_GID (task selected in list view)
  const listTaskMatch = asanaUrl.match(/\/project\/\d+\/list\/(\d+)/);
  if (listTaskMatch) return listTaskMatch[1];
  // Old format: /0/SOMETHING/TASK_GID or /0/SOMETHING/TASK_GID/f
  const twoSegment = asanaUrl.match(/app\.asana\.com\/0\/\d+\/(\d+)/);
  if (twoSegment) return twoSegment[1];
  // Old format: /0/TASK_GID/f (single segment with /f suffix)
  const singleSegment = asanaUrl.match(/app\.asana\.com\/0\/(\d+)\/f/);
  if (singleSegment) return singleSegment[1];
  return null;
}

// ---------------------------------------------------------------------------
// Helper: Determine if the asana_url points to a task vs a project
// Task URLs have a second numeric segment or end in /f
// Project URLs end in /list, /board, /timeline, or have only one segment
// ---------------------------------------------------------------------------
function isTaskUrl(asanaUrl: string | null): boolean {
  if (!asanaUrl) return false;
  // New format: /task/TASK_GID
  if (/\/task\/\d+/.test(asanaUrl)) return true;
  // New format: /project/PROJECT/list/TASK_GID (task selected in list view)
  if (/\/project\/\d+\/list\/\d+/.test(asanaUrl)) return true;
  // Old format: /0/TASK_GID/f
  if (/app\.asana\.com\/0\/\d+\/f/.test(asanaUrl)) return true;
  // Old format: /0/PROJECT_GID/TASK_GID (two numeric segments, not a view suffix)
  if (/app\.asana\.com\/0\/\d+\/\d+/.test(asanaUrl) && !/\/(list|board|timeline|calendar)/.test(asanaUrl)) return true;
  return false;
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
  // createTask – LIVE: Create a task in a project
  // -------------------------------------------------------------------------
  async createTask(payload: {
    name: string;
    notes?: string;
    due_on?: string | null;
    projects?: string[];
    assignee?: string | null;
    custom_fields?: Record<string, string>;
  }) {
    return withFailSafe("createTask", async () => {
      const url = `${ASANA_BASE_URL}/tasks`;
      const data: any = { name: payload.name };
      if (payload.notes) data.notes = payload.notes;
      if (payload.due_on) data.due_on = payload.due_on;
      if (payload.projects) data.projects = payload.projects;
      if (payload.assignee) data.assignee = payload.assignee;
      if (payload.custom_fields) data.custom_fields = payload.custom_fields;

      console.log("[AsanaService] POST", url, JSON.stringify(data));
      const res = await fetch(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Asana API error ${res.status}: ${body}`);
      }
      const json = await res.json();
      return json.data;
    });
  }

  // -------------------------------------------------------------------------
  // createSubtask – LIVE: Create a subtask under a parent task
  // -------------------------------------------------------------------------
  async createSubtask(parentTaskGid: string, payload: {
    name: string;
    notes?: string;
    due_on?: string | null;
    assignee?: string | null;
    custom_fields?: Record<string, string>;
  }) {
    return withFailSafe("createSubtask", async () => {
      const url = `${ASANA_BASE_URL}/tasks/${parentTaskGid}/subtasks`;
      const data: any = { name: payload.name };
      if (payload.notes) data.notes = payload.notes;
      if (payload.due_on) data.due_on = payload.due_on;
      if (payload.assignee) data.assignee = payload.assignee;
      if (payload.custom_fields) data.custom_fields = payload.custom_fields;

      console.log("[AsanaService] POST subtask", url, JSON.stringify(data));
      const res = await fetch(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Asana API error ${res.status}: ${body}`);
      }
      const json = await res.json();
      return json.data;
    });
  }

  // -------------------------------------------------------------------------
  // lookupVisibilityField – Find PW_Visibility custom field GID and enum options
  // by inspecting a task's custom_fields
  // -------------------------------------------------------------------------
  async lookupVisibilityField(taskGid: string): Promise<{
    fieldGid: string;
    internalOnlyGid: string;
    clientVisibleGid: string;
  } | null> {
    return withFailSafe("lookupVisibilityField", async () => {
      const url = `${ASANA_BASE_URL}/tasks/${taskGid}?opt_fields=custom_fields`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return null;
      const json = await res.json();
      const cfs = json.data?.custom_fields || [];
      const visField = cfs.find(
        (cf: any) => cf.name === "PW_Visibility" || cf.name?.toLowerCase().includes("visibility"),
      );
      if (!visField || !visField.enum_options) return null;
      const internalOpt = visField.enum_options.find((o: any) => o.name === "Internal Only");
      const clientOpt = visField.enum_options.find((o: any) => o.name === "Client Visible");
      if (!internalOpt || !clientOpt) return null;
      return {
        fieldGid: visField.gid,
        internalOnlyGid: internalOpt.gid,
        clientVisibleGid: clientOpt.gid,
      };
    });
  }

  // -------------------------------------------------------------------------
  // updateTask – LIVE: Update task fields (name, notes, due_on, completed)
  // -------------------------------------------------------------------------
  async updateTask(taskGid: string, updates: {
    name?: string;
    notes?: string;
    due_on?: string | null;
    completed?: boolean;
  }) {
    return withFailSafe("updateTask", async () => {
      const url = `${ASANA_BASE_URL}/tasks/${taskGid}`;
      console.log("[AsanaService] PUT", url, JSON.stringify(updates));

      const res = await fetch(url, {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({ data: updates }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Asana API error ${res.status}: ${body}`);
      }
      const json = await res.json();
      return json.data;
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
  // getProjectMembers – LIVE: Fetch members of an Asana project
  // -------------------------------------------------------------------------
  async getProjectMembers(projectGid: string) {
    return withFailSafe("getProjectMembers", async () => {
      const url = `${ASANA_BASE_URL}/projects/${projectGid}/members?opt_fields=name,email`;
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
  // getTasksForProject – LIVE: Fetch tasks from an Asana project
  // -------------------------------------------------------------------------
  async getTasksForProject(projectGid: string) {
    return withFailSafe("getTasksForProject", async () => {
      const url = `${ASANA_BASE_URL}/projects/${projectGid}/tasks?opt_fields=name,completed,due_on,assignee.name,assignee.gid,assignee_status,custom_fields,memberships.section.name,followers,notes&limit=100`;
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
  // getTaskDetail – LIVE: Fetch a single task with full details
  // -------------------------------------------------------------------------
  async getTaskDetail(taskGid: string) {
    return withFailSafe("getTaskDetail", async () => {
      const url = `${ASANA_BASE_URL}/tasks/${taskGid}?opt_fields=name,completed,due_on,notes,memberships.section.name,custom_fields,assignee.name`;
      console.log("[AsanaService] GET task detail", url);

      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Asana API error ${res.status}: ${body}`);
      }
      const json = await res.json();
      return json.data;
    });
  }

  // -------------------------------------------------------------------------
  // getSubtasks – LIVE: Fetch subtasks of a parent task
  // -------------------------------------------------------------------------
  async getSubtasks(taskGid: string) {
    return withFailSafe("getSubtasks", async () => {
      const url = `${ASANA_BASE_URL}/tasks/${taskGid}/subtasks?opt_fields=name,completed,due_on,notes,memberships.section.name,custom_fields,assignee.name&limit=100`;
      console.log("[AsanaService] GET subtasks for", taskGid);

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

  // -------------------------------------------------------------------------
  // verifyTaskIsSubtaskOf – Privacy guardrail for task-based access
  // -------------------------------------------------------------------------
  async verifyTaskIsSubtaskOf(taskGid: string, parentTaskGid: string): Promise<boolean> {
    return withFailSafe("verifyTaskIsSubtaskOf", async () => {
      // Check if task is the parent itself
      if (taskGid === parentTaskGid) return true;
      // Fetch parent of the task
      const url = `${ASANA_BASE_URL}/tasks/${taskGid}?opt_fields=parent.gid`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return false;
      const json = await res.json();
      return json.data?.parent?.gid === parentTaskGid;
    });
  }
}

// ---------------------------------------------------------------------------
// Portal token validation helper
// ---------------------------------------------------------------------------
async function validatePortalToken(
  portalToken: string,
): Promise<{ contactId: string; asanaProjectGid: string | null; asanaTaskGid: string | null; isTaskBased: boolean } | null> {
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

  // Get the contact's asana_url
  const { data: contact } = await supabase
    .from("contacts")
    .select("asana_url")
    .eq("id", tokenData.contact_id)
    .maybeSingle();

  const asanaUrl = contact?.asana_url || null;
  const taskBased = isTaskUrl(asanaUrl);

  return {
    contactId: tokenData.contact_id,
    asanaProjectGid: taskBased ? null : extractProjectGid(asanaUrl),
    asanaTaskGid: taskBased ? extractTaskGid(asanaUrl) : null,
    isTaskBased: taskBased,
  };
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
    let portalContext: { contactId: string; asanaProjectGid: string | null; asanaTaskGid: string | null; isTaskBased: boolean } | null = null;

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
      case "createTask": {
        const { name, notes, due_on, project_gid, assignee, custom_fields } = params;
        if (!name) {
          return new Response(
            JSON.stringify({ error: "name is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        result = await service.createTask({
          name,
          notes,
          due_on,
          projects: project_gid ? [project_gid] : undefined,
          assignee,
          custom_fields,
        });
        break;
      }

      case "createSubtask": {
        const { parent_task_gid, name: subtaskName, notes: subtaskNotes, due_on: subtaskDueOn, assignee: subtaskAssignee, custom_fields: subtaskCf } = params;
        if (!parent_task_gid || !subtaskName) {
          return new Response(
            JSON.stringify({ error: "parent_task_gid and name are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        result = await service.createSubtask(parent_task_gid, {
          name: subtaskName,
          notes: subtaskNotes,
          due_on: subtaskDueOn,
          assignee: subtaskAssignee,
          custom_fields: subtaskCf,
        });
        break;
      }

      case "lookupVisibilityField": {
        const { task_gid: lookupTaskGid } = params;
        if (!lookupTaskGid) {
          return new Response(
            JSON.stringify({ error: "task_gid is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        result = await service.lookupVisibilityField(lookupTaskGid);
        break;
      }

      case "getSubtasks": {
        const { task_gid: subtaskParentGid } = params;
        if (!subtaskParentGid) {
          return new Response(
            JSON.stringify({ error: "task_gid is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        result = await service.getSubtasks(subtaskParentGid);
        break;
      }

      case "getProjectStatus":
        result = await service.getProjectStatus(params as any);
        break;

      case "getTasksForProject": {
        // Task-based portal path: fetch parent task + subtasks
        if (portalContext?.isTaskBased && portalContext.asanaTaskGid) {
          const parentTaskGid = portalContext.asanaTaskGid;
          const [parentTask, subtasks] = await Promise.all([
            service.getTaskDetail(parentTaskGid),
            service.getSubtasks(parentTaskGid),
          ]);

          // Combine parent + subtasks, apply visibility filter for portal
          const allTasks = [parentTask, ...subtasks].filter(Boolean);
          const visibleTasks = allTasks.filter((task: any) => {
            const customFields = task.custom_fields || [];
            const isVisible = customFields.some(
              (cf: any) =>
                (cf.name === "PW_Visibility" || cf.name?.toLowerCase().includes("visibility")) &&
                cf.enum_value?.name === "Client Visible",
            );
            return isVisible;
          });
          result = visibleTasks;
          break;
        }

        // Project-based path
        const projectGid = portalContext?.asanaProjectGid || params.project_gid;
        if (!projectGid) {
          return new Response(
            JSON.stringify({ error: "No Asana project configured for this contact" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const allTasks = await service.getTasksForProject(projectGid);

        // Portal users only see tasks marked "Client Visible" via PW_Visibility custom field
        if (portalContext) {
          const visibleTasks = (allTasks as any[]).filter((task: any) => {
            const customFields = task.custom_fields || [];
            return customFields.some(
              (cf: any) =>
                (cf.name === "PW_Visibility" || cf.name?.toLowerCase().includes("visibility")) &&
                cf.enum_value?.name === "Client Visible",
            );
          });
          result = visibleTasks;
        } else {
          result = allTasks;
        }
        break;
      }

      case "getProjectMembers": {
        const pmProjectGid = portalContext?.asanaProjectGid || params.project_gid;
        if (!pmProjectGid) {
          return new Response(
            JSON.stringify({ error: "project_gid is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        result = await service.getProjectMembers(pmProjectGid);
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
        // Privacy guardrail: if portal, verify task access
        if (portalContext) {
          let hasAccess = false;
          if (portalContext.isTaskBased && portalContext.asanaTaskGid) {
            hasAccess = await service.verifyTaskIsSubtaskOf(task_gid, portalContext.asanaTaskGid);
          } else if (portalContext.asanaProjectGid) {
            hasAccess = await service.verifyTaskBelongsToProject(task_gid, portalContext.asanaProjectGid);
          }
          if (!hasAccess) {
            return new Response(
              JSON.stringify({ error: "Access denied" }),
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
          let hasAccess = false;
          if (portalContext.isTaskBased && portalContext.asanaTaskGid) {
            hasAccess = await service.verifyTaskIsSubtaskOf(tGid, portalContext.asanaTaskGid);
          } else if (portalContext.asanaProjectGid) {
            hasAccess = await service.verifyTaskBelongsToProject(tGid, portalContext.asanaProjectGid);
          }
          if (!hasAccess) {
            return new Response(
              JSON.stringify({ error: "Access denied" }),
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

      case "updateTask": {
        const { task_gid: updateGid, updates } = params;
        if (!updateGid || !updates) {
          return new Response(
            JSON.stringify({ error: "task_gid and updates are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Privacy guardrail for portal users
        if (portalContext) {
          let hasAccess = false;
          if (portalContext.isTaskBased && portalContext.asanaTaskGid) {
            hasAccess = await service.verifyTaskIsSubtaskOf(updateGid, portalContext.asanaTaskGid);
          } else if (portalContext.asanaProjectGid) {
            hasAccess = await service.verifyTaskBelongsToProject(updateGid, portalContext.asanaProjectGid);
          }
          if (!hasAccess) {
            return new Response(
              JSON.stringify({ error: "Access denied" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
        result = await service.updateTask(updateGid, updates);
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

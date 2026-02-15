import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Types ----------

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

// ---------- Auth Helper ----------

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const unsigned = `${enc(header)}.${enc(payload)}`;

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Token exchange failed: ${data.error_description || data.error}`);
  return data.access_token;
}

// ---------- System Prompt ----------

const SYSTEM_PROMPT = `You are the **Sovereignty Assistant**, the AI support layer for the Personal CFO at ProsperWise.

## Your Role
- You are a Machine assistant. The Personal CFO is the Human decision-maker.
- Every output you produce is a **Draft for CFO Review** — you NEVER take autonomous action.
- You identify yourself as "Sovereignty Assistant" and address the user as "Personal CFO."

## Your Capabilities (via Function Calling)
When appropriate, use these tools to propose structured actions:

1. **propose_vineyard_update** — Extract and propose updates to a contact's Vineyard financial metrics (EBITDA, Operating Income, Balance Sheet Summary).
2. **propose_storehouse_update** — Propose updates to a contact's Storehouse (liquidity vessel) configuration.
3. **draft_stabilization_email** — Draft a "Stabilization Email" and save it as a Gmail draft for the Personal CFO to review before sending.
4. **draft_asana_task** — Draft a follow-up task description for Asana. This stays in DRAFT status.
5. **create_contact** — Create a new contact record in the system with the provided details.
6. **update_contact** — Update an existing contact's information (name, email, phone, address, professional links, etc.).
7. **schedule_meeting** — Schedule a Google Calendar meeting with specified attendees, date/time, and details.

## Rules
- ALWAYS label your outputs as "📋 Draft for CFO Review" when proposing actions.
- NEVER claim to have executed an action. Always say you are proposing it for review.
- When analyzing documents, extract specific financial data points and map them to the Vineyard/Storehouse schema.
- Maintain PIPEDA compliance — never suggest sending client data outside the secure environment.
- Be concise, professional, and action-oriented.
- When you don't have enough context, ask clarifying questions before proposing actions.
- For emails, always use the draft_stabilization_email tool so the email is saved as a Gmail draft.
- For meetings, collect date, time, duration, attendees, and purpose before proposing.
- When creating or updating contacts, confirm the details with the CFO before proposing.`;

// ---------- Tool Definitions ----------

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "propose_vineyard_update",
        description: "Propose updates to a contact's Vineyard financial metrics. Returns a structured proposal for CFO approval.",
        parameters: {
          type: "OBJECT",
          properties: {
            contact_id: { type: "STRING", description: "UUID of the contact to update" },
            contact_name: { type: "STRING", description: "Name of the contact for display" },
            vineyard_ebitda: { type: "NUMBER", description: "Proposed EBITDA value" },
            vineyard_operating_income: { type: "NUMBER", description: "Proposed Operating Income value" },
            vineyard_balance_sheet_summary: { type: "STRING", description: "Proposed Balance Sheet summary text" },
            rationale: { type: "STRING", description: "Explanation of why these values are being proposed" },
          },
          required: ["contact_id", "contact_name", "rationale"],
        },
      },
      {
        name: "propose_storehouse_update",
        description: "Propose updates to a contact's Storehouse (liquidity vessel) configuration.",
        parameters: {
          type: "OBJECT",
          properties: {
            contact_id: { type: "STRING", description: "UUID of the contact" },
            contact_name: { type: "STRING", description: "Name of the contact for display" },
            storehouse_number: { type: "INTEGER", description: "Storehouse number (1-4)" },
            label: { type: "STRING", description: "Storehouse label" },
            asset_type: { type: "STRING", description: "Type of asset" },
            risk_cap: { type: "STRING", description: "Risk cap description" },
            charter_alignment: { type: "STRING", description: "One of: aligned, misaligned, pending_review" },
            notes: { type: "STRING", description: "Additional notes" },
            rationale: { type: "STRING", description: "Explanation of why this update is proposed" },
          },
          required: ["contact_id", "contact_name", "storehouse_number", "rationale"],
        },
      },
      {
        name: "draft_stabilization_email",
        description: "Draft a Stabilization Email and save it as a Gmail draft for the Personal CFO to review before sending.",
        parameters: {
          type: "OBJECT",
          properties: {
            to_email: { type: "STRING", description: "Recipient email address" },
            to_name: { type: "STRING", description: "Recipient name" },
            subject: { type: "STRING", description: "Email subject line" },
            body: { type: "STRING", description: "Full email body text" },
            context: { type: "STRING", description: "Brief context about why this email is being drafted" },
          },
          required: ["to_email", "to_name", "subject", "body", "context"],
        },
      },
      {
        name: "draft_asana_task",
        description: "Draft a follow-up task for Asana. The task description stays in DRAFT status until the Personal CFO reviews it.",
        parameters: {
          type: "OBJECT",
          properties: {
            task_title: { type: "STRING", description: "Task title" },
            task_description: { type: "STRING", description: "Detailed task description" },
            contact_name: { type: "STRING", description: "Related contact name" },
            priority: { type: "STRING", description: "Priority level: low, medium, high" },
            context: { type: "STRING", description: "Why this task is needed" },
          },
          required: ["task_title", "task_description", "contact_name", "context"],
        },
      },
      {
        name: "create_contact",
        description: "Create a new contact record in the system. The contact will be created after CFO approval.",
        parameters: {
          type: "OBJECT",
          properties: {
            first_name: { type: "STRING", description: "Contact's first name" },
            last_name: { type: "STRING", description: "Contact's last name" },
            email: { type: "STRING", description: "Contact's email address" },
            phone: { type: "STRING", description: "Contact's phone number" },
            address: { type: "STRING", description: "Contact's address" },
            fiduciary_entity: { type: "STRING", description: "Fiduciary entity type: pws or pwa" },
            governance_status: { type: "STRING", description: "Governance status: stabilization or sovereign" },
            rationale: { type: "STRING", description: "Why this contact is being added" },
          },
          required: ["first_name", "rationale"],
        },
      },
      {
        name: "update_contact",
        description: "Update an existing contact's information. Changes are applied after CFO approval.",
        parameters: {
          type: "OBJECT",
          properties: {
            contact_id: { type: "STRING", description: "UUID of the contact to update" },
            contact_name: { type: "STRING", description: "Current name of the contact for display" },
            first_name: { type: "STRING", description: "Updated first name" },
            last_name: { type: "STRING", description: "Updated last name" },
            email: { type: "STRING", description: "Updated email address" },
            phone: { type: "STRING", description: "Updated phone number" },
            address: { type: "STRING", description: "Updated address" },
            fiduciary_entity: { type: "STRING", description: "Updated fiduciary entity: pws or pwa" },
            governance_status: { type: "STRING", description: "Updated governance status: stabilization or sovereign" },
            google_drive_url: { type: "STRING", description: "Updated Google Drive URL" },
            asana_url: { type: "STRING", description: "Updated Asana URL" },
            sidedrawer_url: { type: "STRING", description: "Updated Sidedrawer URL" },
            ia_financial_url: { type: "STRING", description: "Updated IA Financial URL" },
            lawyer_name: { type: "STRING", description: "Updated lawyer name" },
            lawyer_firm: { type: "STRING", description: "Updated lawyer firm" },
            accountant_name: { type: "STRING", description: "Updated accountant name" },
            accountant_firm: { type: "STRING", description: "Updated accountant firm" },
            rationale: { type: "STRING", description: "Why these updates are being proposed" },
          },
          required: ["contact_id", "contact_name", "rationale"],
        },
      },
      {
        name: "schedule_meeting",
        description: "Schedule a Google Calendar meeting. The meeting is created after CFO approval.",
        parameters: {
          type: "OBJECT",
          properties: {
            summary: { type: "STRING", description: "Meeting title" },
            description: { type: "STRING", description: "Meeting description/agenda" },
            start_datetime: { type: "STRING", description: "Start date and time in ISO 8601 format (e.g., 2026-02-20T10:00:00)" },
            end_datetime: { type: "STRING", description: "End date and time in ISO 8601 format (e.g., 2026-02-20T11:00:00)" },
            timezone: { type: "STRING", description: "Timezone (e.g., America/Toronto). Defaults to America/Toronto." },
            attendees: { type: "STRING", description: "Comma-separated list of attendee email addresses" },
            contact_name: { type: "STRING", description: "Related contact name for audit trail" },
            rationale: { type: "STRING", description: "Purpose/context for this meeting" },
          },
          required: ["summary", "start_datetime", "end_datetime", "rationale"],
        },
      },
    ],
  },
];

// ---------- Main ----------

const REGION = "northamerica-northeast1";
const MODEL = "gemini-2.5-pro";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { messages, model, contactContext, documentData } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load service account key
    const saKeyRaw = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY");
    if (!saKeyRaw) throw new Error("GCP_SERVICE_ACCOUNT_KEY not configured");
    let cleaned = saKeyRaw.trim().replace(/^\uFEFF/, "");
    if (!cleaned.startsWith("{")) cleaned = "{" + cleaned;
    if (!cleaned.endsWith("}")) cleaned = cleaned + "}";
    const saKey: ServiceAccountKey = JSON.parse(cleaned);
    const accessToken = await getAccessToken(saKey);

    const selectedModel = model || MODEL;
    const projectId = saKey.project_id;

    // Build system instruction with optional contact context
    let systemText = SYSTEM_PROMPT;
    if (contactContext) {
      systemText += `\n\n## Current Contact Context\n${JSON.stringify(contactContext, null, 2)}`;
    }

    // Build contents - support multimodal (documents/images)
    const contents: any[] = [];
    for (const m of messages) {
      if (m.role === "system") continue;
      const parts: any[] = [];

      if (m.content) {
        parts.push({ text: m.content });
      }

      // If this message has document data (base64 image/PDF)
      if (m.documentData) {
        parts.push({
          inlineData: {
            mimeType: m.documentData.mimeType,
            data: m.documentData.base64,
          },
        });
      }

      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts,
      });
    }

    // Also handle top-level documentData for convenience
    if (documentData && contents.length > 0) {
      const lastUserMsg = [...contents].reverse().find((c) => c.role === "user");
      if (lastUserMsg) {
        lastUserMsg.parts.push({
          inlineData: {
            mimeType: documentData.mimeType,
            data: documentData.base64,
          },
        });
      }
    }

    const vertexBody: any = {
      contents,
      systemInstruction: { parts: [{ text: systemText }] },
      tools: TOOLS,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain",
      },
    };

    const endpoint = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${REGION}/publishers/google/models/${selectedModel}:generateContent`;

    const vertexRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vertexBody),
    });

    if (!vertexRes.ok) {
      const errText = await vertexRes.text();
      console.error("Vertex AI error:", vertexRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Vertex AI error: ${vertexRes.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await vertexRes.json();
    const candidate = result?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Extract text and function calls
    const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
    const functionCalls = parts
      .filter((p: any) => p.functionCall)
      .map((p: any) => ({
        name: p.functionCall.name,
        args: p.functionCall.args,
      }));

    return new Response(
      JSON.stringify({
        text: textParts.join("\n"),
        functionCalls,
        raw: result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vertex-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

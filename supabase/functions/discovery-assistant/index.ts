import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

// ---------- Vertex AI Auth ----------

const REGION = "northamerica-northeast1";
const MODEL = "gemini-2.5-flash";

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

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
  const enc = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsigned));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${unsigned}.${signature}`;
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token exchange failed: ${data.error_description || data.error}`);
  return data.access_token;
}

// ---------- Georgia System Prompt ----------

const GEORGIA_SYSTEM_PROMPT = `You are **Georgia**, the Integration Assistant for ProsperWise — a Fee-Only family office based in Canada.

## Your Persona
- **Tone**: Empathetic, calm, professional, and boutique. You speak like a trusted, high-level Personal CFO — not a customer service rep or salesperson.
- **Philosophy**: "Don't Invest. Decompress." You focus on helping people through the Quiet Period following major life transitions.
- **You are NOT a financial advisor.** You are a Strategy Assistant representing ProsperWise Strategy (PWS), not the licensed execution arm. State this explicitly when relevant.

## About Rolf Issler
If a visitor DIRECTLY asks about Rolf's background, qualifications, credentials, or why they should work with him, respond with:
"Rolf is our lead advisor, and founder of ProsperWise. He holds a Bachelor of Management (BMgt) from the University of British Columbia (UBC) and the Chartered Life Underwriter (CLU) designation. He built this firm specifically to protect families navigating high-stakes transitions."
**Do NOT mention Rolf proactively until the user's Chaos Profile has been fully validated (see Discovery Flow).**

## CRITICAL: Knowledge Base Override
**If the Knowledge Base section below contains strategy instructions, those instructions TAKE PRIORITY over the defaults in this prompt.**

## The Discovery Flow (STRICT MULTI-STEP GATING)

You MUST follow these steps IN ORDER. Do NOT skip steps.

### Step 1: The Greeting
The greeting has already been delivered automatically. Do NOT repeat it. Skip to Step 2.

### Step 2: The Forensic Integration Audit (Anti-Rush Policy)
This is the MOST IMPORTANT step. You MUST ask **at least 4-5 deepening questions** before moving to Step 3.
- Do NOT mention the Integration Session, Rolf, or any next step during this phase.
- Focus on: Integration Classification, Timing, Complexity, Non-Financial Liabilities, The 'Baggage', Anxiety Anchor, Vision Diagnostic, Emotional Validation.

### Step 3: The Integration Session (The Binary Ask)
ONLY after thorough discovery:
- Explain the **Integration Session**: a focused 60-minute paid working session ($295) with Rolf Issler.
- Ask clearly: "Shall we proceed with scheduling a Integration Session?"
- Wait for a clear "Yes" before triggering register_discovery_lead.

### The "Wait & See" Protocol
If hesitation: pivot back to discovery. If firm decline: gracefully close.

### Step 4: Lead Capture
ONLY after "Yes", call **register_discovery_lead** then ask for details.

## Vocabulary Rules
- NEVER use: "Portfolio," "Alpha," "ROI," "Returns," "Asset Allocation"
- USE: "Sovereignty," "Governance," "Stabilization," "Storehouse," "Charter," "Quiet Period"

## Rules
- NEVER skip deepening questions.
- NEVER mention Rolf or Integration Session until audit is complete.
- Keep responses under 150 words unless asked for elaboration.`;

// ---------- Tool Definitions (Vertex format) ----------

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "register_discovery_lead",
        description: "Register a new discovery lead after the prospect has agreed to the Transition Session.",
        parameters: {
          type: "OBJECT",
          properties: {
            transition_type: {
              type: "STRING",
              description: "Type of transition: business_sale, divorce, legacy_event, or other",
            },
            anxiety_anchor: { type: "STRING", description: "The prospect's primary friction point or anxiety" },
            vision_summary: { type: "STRING", description: "Their 3-year sovereignty vision summary" },
            vineyard_summary: { type: "STRING", description: "Summary of vineyard audit findings" },
            discovery_notes: { type: "STRING", description: "Full conversation summary" },
          },
          required: ["transition_type", "discovery_notes"],
        },
      },
    ],
  },
];

// ---------- Main ----------

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, action, leadData } = await req.json();

    // Handle lead registration action
    if (action === "register_lead") {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      const { first_name, phone, email, pipeda_consent, ...discoveryData } = leadData;

      if (!first_name || !email) {
        return new Response(JSON.stringify({ error: "First name and email are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!pipeda_consent) {
        return new Response(JSON.stringify({ error: "PIPEDA consent is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(JSON.stringify({ error: "Invalid email address" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("discovery_leads")
        .insert({
          first_name: first_name.trim().slice(0, 100),
          phone: phone?.trim().slice(0, 20) || null,
          email: email.trim().toLowerCase().slice(0, 255),
          transition_type: discoveryData.transition_type || null,
          anxiety_anchor: discoveryData.anxiety_anchor || null,
          vision_summary: discoveryData.vision_summary || null,
          vineyard_summary: discoveryData.vineyard_summary || null,
          discovery_notes: discoveryData.discovery_notes || null,
          sovereignty_status: "transition_session_requested",
          pipeda_consent: true,
          pipeda_consented_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Lead insert error:", error);
        return new Response(JSON.stringify({ error: "Failed to register lead" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, leadId: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chat flow
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch knowledge base
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: kbEntries } = await supabaseAdmin
      .from("knowledge_base")
      .select("title, content, category, target")
      .eq("is_active", true)
      .in("target", ["transition", "both"])
      .order("category");

    let knowledgeBlock = "";
    if (kbEntries && kbEntries.length > 0) {
      knowledgeBlock =
        "\n\n## Knowledge Base\n" +
        kbEntries.map((e: any) => `### ${e.title} [${e.category}]\n${e.content}`).join("\n\n");
    }

    const systemContent = GEORGIA_SYSTEM_PROMPT + knowledgeBlock;

    // Convert messages to Vertex AI format
    const vertexContents: any[] = [
      { role: "user", parts: [{ text: systemContent }] },
      { role: "model", parts: [{ text: "Understood. I am Georgia, the Transition Assistant." }] },
    ];
    for (const m of messages) {
      if (m.role === "system") continue;
      vertexContents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }

    // Vertex AI call — pinned to Montreal
    const gcpKeyRaw = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY");
    if (!gcpKeyRaw) throw new Error("GCP_SERVICE_ACCOUNT_KEY not configured");
    const sa: ServiceAccountKey = JSON.parse(gcpKeyRaw);
    const accessToken = await getAccessToken(sa);

    const vertexUrl = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/${REGION}/publishers/google/models/${MODEL}:generateContent`;

    console.log(`[discovery-assistant] Calling Vertex AI in ${REGION}`);

    const aiResponse = await fetch(vertexUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: vertexContents,
        tools: TOOLS,
        generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[discovery-assistant] Vertex AI error ${aiResponse.status}:`, errText);
      return new Response(JSON.stringify({ error: "Georgia is temporarily unavailable. Please try again." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await aiResponse.json();
    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let text = "";
    const functionCalls: Array<{ name: string; args: any }> = [];

    for (const part of parts) {
      if (part.text) text += part.text;
      if (part.functionCall) {
        functionCalls.push({ name: part.functionCall.name, args: part.functionCall.args || {} });
      }
    }

    return new Response(JSON.stringify({ text, functionCalls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("discovery-assistant error:", e);
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

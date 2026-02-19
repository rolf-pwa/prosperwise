import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Georgia System Prompt ----------

const GEORGIA_SYSTEM_PROMPT = `You are **Georgia**, the Transition Assistant for ProsperWise — a Fee-Only family office based in Canada.

## Your Persona
- **Tone**: Empathetic, calm, professional, and boutique. You speak like a trusted guide, not a salesperson.
- **Philosophy**: "Don't Invest. Decompress." You focus on helping people through the Quiet Period following major life transitions.
- **You are NOT a financial advisor.** You are a concierge who listens, validates, and guides toward a professional working session.

## About Rolf Issler
If a visitor asks about Rolf's background, qualifications, credentials, or why they should work with him, respond with:
"Rolf is our lead advisor, and founder of ProsperWise. He holds a Bachelor of Management (BMgt) from the University of British Columbia (UBC) and the Chartered Life Underwriter (CLU) designation. He built this firm specifically to protect families navigating high-stakes transitions."

## The Discovery Flow (STRICT MULTI-STEP GATING)

You MUST follow these steps IN ORDER. Do NOT skip steps. Do NOT show lead capture fields until explicitly authorized.

### Step 1: The Greeting
The greeting has already been delivered to the user automatically. Do NOT repeat the greeting. The delivered greeting is: "Welcome to ProsperWise. My name is Georgia, and I am your Transition Assistant. Most people come here during a time of significant transition — a business sale, a separation, or a legacy event. How can I help you navigate your transition?" If the conversation history already contains this welcome message as the first assistant message, skip directly to Step 2 and respond to the user's input with a deepening question.

### Step 2: The Vineyard Audit (Anti-Rush Policy)
You MUST ask **at least two deepening questions** before moving to Step 3. Focus on:
- **Timing**: Is the liquidity settled or still 'pre-flight'?
- **Complexity**: Are there other stakeholders (spouses, children with special needs, business partners)?
- **The 'Baggage'**: Is there pressure from current advisors or external 'noise'?
- **Anxiety Anchor**: Identify their primary friction point — what keeps them up at night?
- **Vision Diagnostic**: Ask: "In your vision of 'Sovereignty,' what does total peace of mind look like for you three years from now?"

Track internally how many deepening questions you've asked. Do NOT move to Step 3 until you've asked at least 2.

### Step 3: The Transition Session (The Binary Ask)
Once you've gathered enough context:
- Explain the **Transition Session**: "Based on what you've shared, I'd like to suggest a next step. ProsperWise offers a Transition Session — a focused 60-minute paid working session ($295) with Rolf Issler, our lead advisor and founder. Rolf works for you — this is not a sales pitch. He'll assess your situation and provide clear, actionable guidance."
- **The Gate**: Ask clearly: "Shall we proceed with scheduling a Transition Session?"
- **Wait for a clear "Yes"** before triggering the register_discovery_lead function.

### The Hesitation Loop
If the user:
- Asks about fees → Explain: "ProsperWise operates as a Fee-Only service. This means we don't earn commissions on products. The $295 session fee ensures Rolf is working objectively for your interests, not for a sales quota."
- Says "no" or hesitates → Acknowledge, then gently circle back: "I completely understand. Many of our clients felt the same way initially. The Transition Session is designed specifically for people who want clarity without commitment. Would you like me to explain what the session covers in more detail?"
- If they firmly decline → Gracefully close: "That's perfectly alright. ProsperWise is here whenever you're ready. I wish you peace in your transition."

### Step 4: Lead Capture
ONLY after receiving a "Yes" to the Transition Session, call the **register_discovery_lead** function with:
- A summary of the conversation (vineyard findings, anxiety anchor, vision)
- The transition type identified
- Then tell the user: "Wonderful. I just need a few details to get you connected with Rolf."

## Rules
- NEVER skip the deepening questions. This is the Anti-Rush Policy.
- NEVER show or ask for personal details (name, email, phone) until the user says "Yes" to the Transition Session.
- NEVER claim to provide financial advice.
- NEVER discuss specific investment products or strategies.
- Be warm but professional. Use short paragraphs. Avoid walls of text.
- If the user shares something emotional, acknowledge it before moving on.
- Keep responses under 150 words unless the user asks for elaboration.`;

// ---------- Tool Definitions ----------

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "register_discovery_lead",
        description:
          "Register a new discovery lead after the prospect has agreed to the Transition Session. Only call this AFTER receiving a clear 'Yes' to the session offer.",
        parameters: {
          type: "OBJECT",
          properties: {
            transition_type: {
              type: "STRING",
              description: "Type of transition: business_sale, divorce, legacy_event, or other",
            },
            anxiety_anchor: {
              type: "STRING",
              description: "The prospect's primary friction point or anxiety",
            },
            vision_summary: {
              type: "STRING",
              description: "Their 3-year sovereignty vision summary",
            },
            vineyard_summary: {
              type: "STRING",
              description: "Summary of vineyard audit findings from the conversation",
            },
            discovery_notes: {
              type: "STRING",
              description: "Full conversation summary capturing key points discussed",
            },
          },
          required: ["transition_type", "discovery_notes"],
        },
      },
    ],
  },
];

// ---------- Main ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, action, leadData } = await req.json();

    // Handle lead registration action (called from frontend after form submission)
    if (action === "register_lead") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { first_name, phone, email, pipeda_consent, ...discoveryData } = leadData;

      if (!first_name || !email) {
        return new Response(
          JSON.stringify({ error: "First name and email are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!pipeda_consent) {
        return new Response(
          JSON.stringify({ error: "PIPEDA consent is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate inputs
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ error: "Invalid email address" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase.from("discovery_leads").insert({
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
      }).select().single();

      if (error) {
        console.error("Lead insert error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to register lead" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, leadId: data.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chat flow
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages for OpenAI-compatible API
    const apiMessages: any[] = [
      { role: "system", content: GEORGIA_SYSTEM_PROMPT },
    ];
    for (const m of messages) {
      if (m.role === "system") continue;
      apiMessages.push({ role: m.role, content: m.content });
    }

    // Convert Vertex-style tools to OpenAI-style tools
    const openaiTools = TOOLS[0].functionDeclarations.map((fn: any) => ({
      type: "function",
      function: {
        name: fn.name,
        description: fn.description,
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(fn.parameters.properties).map(([k, v]: [string, any]) => [
              k,
              { type: v.type.toLowerCase(), description: v.description },
            ])
          ),
          required: fn.parameters.required || [],
        },
      },
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const gatewayRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: apiMessages,
        tools: openaiTools,
        temperature: 0.6,
        max_tokens: 2048,
      }),
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      console.error("AI gateway error:", gatewayRes.status, errText);
      const isRateLimit = gatewayRes.status === 429;
      const isPayment = gatewayRes.status === 402;
      return new Response(
        JSON.stringify({
          error: isRateLimit
            ? "Georgia is handling several conversations right now. Please wait a moment and try again."
            : isPayment
            ? "AI service temporarily unavailable. Please try again later."
            : `AI service error: ${gatewayRes.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await gatewayRes.json();
    const choice = result?.choices?.[0];
    const message = choice?.message;

    const text = message?.content || "";
    const functionCalls = (message?.tool_calls || [])
      .filter((tc: any) => tc.type === "function")
      .map((tc: any) => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments),
      }));

    return new Response(
      JSON.stringify({ text, functionCalls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("discovery-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

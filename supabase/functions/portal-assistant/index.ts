import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEORGIA_CLIENT_PROMPT = `You are **Georgia**, the Client Support Assistant for ProsperWise Advisors — a Fee-Only family office based in Canada.

## Your Role
You are a dedicated support assistant for EXISTING ProsperWise clients. You are NOT the Transition Assistant for new prospects. Your job is to help current clients with questions about their accounts, services, and next steps.

## Your Persona
- **Tone**: Warm, professional, knowledgeable, and reassuring. You speak like a trusted member of their advisory team.
- **You are NOT a financial advisor.** You cannot provide financial advice, recommend products, or make investment decisions.
- **You represent ProsperWise** and should be familiar with the firm's services and philosophy.

## What You Can Help With
- Explaining ProsperWise services and processes
- Directing clients to the right resources (My Documents, My Accounts, meeting booking)
- Answering general questions about their portal, storehouses, vineyard accounts, and territory view
- Explaining governance concepts (Sovereignty, Stabilization, Charter, Waterfall priorities)
- Helping clients understand what information their Personal CFO needs
- Guiding clients on how to request changes (address updates, beneficiary changes, etc.)
- Explaining fee structures and billing questions at a high level

## What You CANNOT Do
- Provide specific financial advice or investment recommendations
- Access or modify client data directly
- Process transactions or move money
- Make changes to accounts — always direct them to contact their Personal CFO
- Share information about other clients or families

## Important Guidance
- For any account changes (address, beneficiaries, etc.), tell the client: "I'd recommend reaching out to your Personal CFO directly. You can book a meeting using the scheduling links on your portal, or send them a message through the Action Items section."
- For urgent matters, suggest: "For time-sensitive matters, please contact your Personal CFO directly."
- Keep responses concise — under 120 words unless the client asks for elaboration.
- If you don't know something specific to their account, be honest: "I don't have access to that specific information, but your Personal CFO can help you with that."`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiMessages = [
      { role: "system", content: GEORGIA_CLIENT_PROMPT },
      ...messages.filter((m: any) => m.role !== "system").map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const gatewayRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
        temperature: 0.5,
        max_tokens: 1024,
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
            ? "Georgia is busy right now. Please wait a moment and try again."
            : isPayment
            ? "Support assistant temporarily unavailable. Please try again later."
            : `AI service error: ${gatewayRes.status}`,
        }),
        { status: gatewayRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await gatewayRes.json();
    const text = result?.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("portal-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

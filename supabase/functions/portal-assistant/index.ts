import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEORGIA_CLIENT_PROMPT = `You are **Georgia**, the Client Support Assistant for ProsperWise Advisors — a Fee-Only family office based in Canada.

## Your Role
You are a dedicated support assistant for EXISTING ProsperWise clients. You are NOT the Transition Assistant for new prospects. Your job is to help current clients with questions, direct them to the right tools, and handle administrative requests as efficiently as possible.

## Your Persona
- **Tone**: Warm, professional, knowledgeable, and reassuring. You speak like a trusted member of their advisory team.
- **You are NOT a financial advisor.** You cannot provide financial advice, recommend products, or make investment decisions.
- **You represent ProsperWise** and should be familiar with the firm's services and philosophy.

## Administrative Requests — USE THE FORM
For ANY administrative or account-related requests, you MUST direct the client to the **ProsperWise Admin Request Form**. This includes but is not limited to:
- Address changes
- Banking updates (adding/changing bank accounts)
- Withdrawal requests
- Beneficiary changes
- Account ownership changes
- Tax document requests
- Name changes
- Any other account modifications

**When a client has an admin request**, respond helpfully and provide this link:
👉 [Submit an Admin Request](https://form.asana.com/?k=u0f1fa0P7AhhBe09vl_TVQ&d=2156967713314)

Example: "I can help with that! To update your address, please submit a request through our secure admin form: https://form.asana.com/?k=u0f1fa0P7AhhBe09vl_TVQ&d=2156967713314 — your Personal CFO will process the change and confirm once it's complete."

## What You Can Also Help With
- Explaining ProsperWise services and processes
- Directing clients to portal features (My Documents, My Accounts, meeting booking)
- Answering general questions about their portal, storehouses, vineyard accounts, and territory view
- Explaining governance concepts (Sovereignty, Stabilization, Charter, Waterfall priorities)
- Helping clients understand what information their Personal CFO needs
- Explaining fee structures and billing questions at a high level

## Portal Features You Can Reference
- **My Documents**: Access your document vault (SideDrawer) from the sidebar
- **My Accounts**: View your IA Financial accounts from the sidebar
- **Book a Meeting**: Schedule in-person or video meetings using the links above the Upcoming Meetings section
- **Action Items**: View and track tasks assigned by your Personal CFO

## What You CANNOT Do
- Provide specific financial advice or investment recommendations
- Access or modify client data directly
- Process transactions or move money
- Share information about other clients or families

## Response Style
- Be action-oriented — always give the client a clear next step
- Keep responses concise — under 120 words unless the client asks for elaboration
- Always include the admin form link when relevant, formatted as a clickable link
- If you don't know something specific to their account, be honest and direct them to their Personal CFO or the admin form
- For urgent matters: "For time-sensitive matters, please contact your Personal CFO directly or submit a priority request through our admin form."`;

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

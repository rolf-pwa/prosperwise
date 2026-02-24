import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

## Administrative Requests — TRIGGER THE FORM
When a client mentions ANY of the following, you MUST call the **open_admin_request_form** function to open the admin request form:
- Address changes
- Banking updates (adding/changing bank accounts)
- Withdrawal requests
- Beneficiary changes
- Account ownership changes
- Tax document requests
- Name changes
- Account statements
- Confirmation letters
- Any other account modifications or document requests

When you detect an admin request:
1. Acknowledge their request warmly
2. Call the **open_admin_request_form** function with the appropriate request_type and a brief description
3. Let the client know the form will help them submit everything securely

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
- If you don't know something specific to their account, be honest and direct them to their Personal CFO
- For urgent matters: "For time-sensitive matters, please contact your Personal CFO directly."`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "open_admin_request_form",
      description:
        "Open the admin request form for the client to submit an administrative request. Call this whenever the client needs to make changes to their account, request documents, update banking info, or any other administrative action.",
      parameters: {
        type: "object",
        properties: {
          request_type: {
            type: "string",
            enum: ["banking_withdrawal", "personal_info", "document_request", "general_inquiry"],
            description:
              "The category of the request: banking_withdrawal (banking changes, withdrawals, PAC/SWP), personal_info (address, name, beneficiary changes), document_request (tax slips, statements), general_inquiry (anything else)",
          },
          prefill_description: {
            type: "string",
            description:
              "A brief description to pre-fill in the form based on what the client described in the conversation",
          },
        },
        required: ["request_type"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Handle form submission action
    if (body.action === "submit_request") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { requestData } = body;
      if (!requestData?.contact_id || !requestData?.request_type || !requestData?.request_description) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate input lengths
      if (requestData.request_description.length > 2000) {
        return new Response(
          JSON.stringify({ error: "Description too long (max 2000 characters)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validTypes = ["banking_withdrawal", "personal_info", "document_request", "general_inquiry"];
      if (!validTypes.includes(requestData.request_type)) {
        return new Response(
          JSON.stringify({ error: "Invalid request type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase.from("portal_requests").insert({
        contact_id: requestData.contact_id,
        request_type: requestData.request_type,
        request_description: requestData.request_description.slice(0, 2000),
        request_details: requestData.request_details || {},
        file_urls: requestData.file_urls || [],
        status: "submitted",
      }).select().single();

      if (error) {
        console.error("Insert error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to submit request" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create in-app notification for staff
      try {
        const { data: contactInfo } = await supabase
          .from("contacts")
          .select("full_name")
          .eq("id", requestData.contact_id)
          .maybeSingle();
        const contactName = contactInfo?.full_name || "A client";
        const typeLabel = requestData.request_type?.replace(/_/g, " ") || "request";
        await supabase.from("staff_notifications").insert({
          title: `${contactName} submitted a new ${typeLabel} request`,
          body: requestData.request_description?.substring(0, 100) || null,
          link: "/requests",
          contact_id: requestData.contact_id,
          source_type: "new_request",
        });
      } catch (notifErr) {
        console.error("[PortalAssistant] Failed to create staff notification:", notifErr);
      }

      // Fire notification email (non-blocking)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/notify-portal-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ request_id: data.id, event_type: "new" }),
      }).catch((e) => console.error("[Notify] Fire-and-forget error:", e));

      return new Response(
        JSON.stringify({ success: true, requestId: data.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chat flow
    const { messages } = body;
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
        tools: TOOLS,
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
    const choice = result?.choices?.[0];
    const message = choice?.message;
    const text = message?.content || "";

    // Extract function calls
    const functionCalls = (message?.tool_calls || [])
      .filter((tc: any) => tc.type === "function")
      .map((tc: any) => {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {}
        return { name: tc.function.name, args };
      });

    return new Response(
      JSON.stringify({ text, functionCalls }),
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

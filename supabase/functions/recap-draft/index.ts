import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { date } = await req.json();
    const targetDate = date || new Date().toISOString().split("T")[0];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Gather day's activity
    const dayStart = `${targetDate}T00:00:00Z`;
    const dayEnd = `${targetDate}T23:59:59Z`;

    const [
      { data: requests },
      { data: pipelineChanges },
      { data: contactsModified },
      { data: holdingTankChanges },
      { data: auditEntries },
      { data: reviewItems },
    ] = await Promise.all([
      sb.from("portal_requests").select("request_type, request_description, status, contact_id").gte("created_at", dayStart).lte("created_at", dayEnd),
      sb.from("business_pipeline").select("category, status, amount, notes").gte("updated_at", dayStart).lte("updated_at", dayEnd),
      sb.from("contacts").select("full_name, governance_status").gte("updated_at", dayStart).lte("updated_at", dayEnd),
      sb.from("holding_tank").select("account_name, status, current_value").gte("updated_at", dayStart).lte("updated_at", dayEnd),
      sb.from("sovereignty_audit_trail").select("action_type, action_description").gte("created_at", dayStart).lte("created_at", dayEnd),
      sb.from("review_queue").select("action_type, action_description, status").gte("created_at", dayStart).lte("created_at", dayEnd),
    ]);

    const activitySummary = JSON.stringify({
      date: targetDate,
      portal_requests: requests || [],
      pipeline_changes: pipelineChanges || [],
      contacts_modified: contactsModified || [],
      holding_tank_activity: holdingTankChanges || [],
      audit_trail: auditEntries || [],
      review_queue: reviewItems || [],
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a daily operations assistant for ProsperWise, a boutique family office advisory firm. Write a concise daily recap in well-structured markdown.

FORMAT RULES (follow exactly):
- Use ## for each section heading (e.g. ## Client Requests)
- Under each heading, use bullet points (- ) for each item
- Indent sub-details with nested bullets (  - )
- Include names, amounts, and statuses where available
- Skip any section that has no data — do not include empty sections
- End with a ## Key Takeaways section containing 2-3 bullet points summarizing the most important items

SECTIONS (use these exact headings when data exists):
## Client Requests
## Pipeline Activity
## Contacts Updated
## Holding Tank
## Governance & Compliance
## Key Takeaways

Keep it professional, concise, and action-oriented.`,
          },
          {
            role: "user",
            content: `Generate a daily recap for ${targetDate} based on this activity data:\n\n${activitySummary}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const result = await aiResponse.json();
    const draft = result.choices?.[0]?.message?.content || "No activity found for this date.";

    return new Response(JSON.stringify({ draft, date: targetDate }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recap-draft error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

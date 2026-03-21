import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Find all unsent updates that are due
    const { data: dueUpdates, error: fetchErr } = await supabase
      .from("marketing_updates")
      .select("*")
      .eq("sent", false)
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", new Date().toISOString());

    if (fetchErr) {
      console.error("[Scheduler] Fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dueUpdates || dueUpdates.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const update of dueUpdates) {
      console.log(`[Scheduler] Sending scheduled update: ${update.title}`);

      // Call notify-portal-request to send the notifications
      const { error: invokeErr } = await supabase.functions.invoke(
        "notify-portal-request",
        {
          body: {
            notify_type: "marketing_update",
            title: update.title,
            url: update.url,
            target_governance_status: update.target_governance_status,
            target_contact_ids: update.target_contact_ids || [],
            target_household_ids: update.target_household_ids || [],
          },
        }
      );

      if (invokeErr) {
        console.error(`[Scheduler] Error sending update ${update.id}:`, invokeErr);
        continue;
      }

      // Mark as sent
      await supabase
        .from("marketing_updates")
        .update({ sent: true } as any)
        .eq("id", update.id);

      processed++;
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Scheduler] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

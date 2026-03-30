import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://prosperwise.lovable.app",
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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

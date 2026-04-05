import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, contact_id, notification_ids } = await req.json();

    if (!contact_id || typeof contact_id !== "string") {
      return new Response(
        JSON.stringify({ error: "contact_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate contact_id exists
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", contact_id)
      .maybeSingle();

    if (!contact) {
      return new Response(
        JSON.stringify({ error: "Invalid contact" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("portal_client_notifications")
        .select("*")
        .eq("contact_id", contact_id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "mark_read") {
      if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: "notification_ids array is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Only mark notifications that belong to this contact
      const { error } = await supabase
        .from("portal_client_notifications")
        .update({ read: true })
        .in("id", notification_ids)
        .eq("contact_id", contact_id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'list' or 'mark_read'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

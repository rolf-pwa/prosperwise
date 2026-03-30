import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { request_id, content, sender_type, sender_name, portal_token } = await req.json();

    if (!request_id || !content || !sender_type) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If client sender, validate portal token
    if (sender_type === "client") {
      if (!portal_token) {
        return new Response(JSON.stringify({ error: "Auth required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tokenData } = await supabase
        .from("portal_tokens")
        .select("contact_id")
        .eq("token", portal_token)
        .eq("revoked", false)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!tokenData) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify the request belongs to this contact
      const { data: requestData } = await supabase
        .from("portal_requests")
        .select("contact_id")
        .eq("id", request_id)
        .maybeSingle();

      if (!requestData || requestData.contact_id !== tokenData.contact_id) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert the message
    const { error: insertError } = await supabase
      .from("portal_request_messages")
      .insert({
        request_id,
        sender_type,
        sender_name: sender_name || null,
        content,
      });

    if (insertError) throw insertError;

    // If client sent a message, create in-app notification for staff
    if (sender_type === "client") {
      // Get contact info for the notification
      const { data: requestData2 } = await supabase
        .from("portal_requests")
        .select("contact_id, request_type, contacts(full_name)")
        .eq("id", request_id)
        .maybeSingle();

      const contactName = (requestData2 as any)?.contacts?.full_name || "A client";
      const requestType = (requestData2 as any)?.request_type || "request";

      await supabase.from("staff_notifications").insert({
        title: `${contactName} replied to a ${requestType} request`,
        body: content.length > 100 ? content.substring(0, 100) + "…" : content,
        link: "/requests",
        contact_id: (requestData2 as any)?.contact_id || null,
        source_type: "request_message",
      });
    }

    // Send notification email (non-blocking)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Notify the other party: if advisor sent, notify client; if client sent, skip (staff sees in CRM)
    if (sender_type === "advisor") {
      fetch(`${supabaseUrl}/functions/v1/notify-portal-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ request_id, event_type: "message" }),
      }).catch((e) => console.error("[Notify] Fire-and-forget error:", e));
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Portal request reply error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TYPE_LABELS: Record<string, string> = {
  banking_withdrawal: "Banking & Withdrawals",
  personal_info: "Personal Info",
  document_request: "Document Request",
  general_inquiry: "General Inquiry",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
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
    const { request_id, event_type } = await req.json();
    // event_type: "new" | "status_update" | "message"

    if (!request_id) {
      return new Response(JSON.stringify({ error: "request_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the portal request with contact info
    const { data: portalRequest, error: fetchErr } = await supabase
      .from("portal_requests")
      .select("*, contact:contacts(id, email, first_name, full_name)")
      .eq("id", request_id)
      .single();

    if (fetchErr || !portalRequest) {
      console.error("[Notify] Failed to fetch request:", fetchErr);
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contact = portalRequest.contact as any;
    if (!contact?.email) {
      console.log("[Notify] No email for contact, skipping notification");
      return new Response(JSON.stringify({ sent: false, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanEmail = contact.email.trim().toLowerCase();
    const requestType = TYPE_LABELS[portalRequest.request_type] || portalRequest.request_type;
    const status = STATUS_LABELS[portalRequest.status] || portalRequest.status;

    // Build subject and message based on event type
    let subject = "";
    let message = "";

    if (event_type === "new") {
      subject = `Your ${requestType} request has been received`;
      message = `Hi ${contact.first_name || "there"},\n\nWe've received your ${requestType} request and will get back to you shortly.\n\nRequest: ${portalRequest.request_description}\n\nThank you,\nProsperWise Team`;
    } else if (event_type === "status_update") {
      subject = `Your ${requestType} request is now ${status}`;
      message = `Hi ${contact.first_name || "there"},\n\nYour ${requestType} request has been updated to: ${status}.\n\nRequest: ${portalRequest.request_description}\n\nThank you,\nProsperWise Team`;
    } else if (event_type === "message") {
      subject = `New message on your ${requestType} request`;
      message = `Hi ${contact.first_name || "there"},\n\nYou have a new message regarding your ${requestType} request.\n\nLog in to your portal to view the details.\n\nThank you,\nProsperWise Team`;
    } else {
      subject = `Update on your ${requestType} request`;
      message = `Hi ${contact.first_name || "there"},\n\nThere's an update on your ${requestType} request.\n\nCurrent status: ${status}\n\nThank you,\nProsperWise Team`;
    }

    // Send via Wix triggered email relay
    const WIX_SITE_URL = Deno.env.get("WIX_SITE_URL");
    const WIX_OTP_SECRET = Deno.env.get("WIX_OTP_SECRET");

    if (!WIX_SITE_URL || !WIX_OTP_SECRET) {
      console.warn("[Notify] Wix secrets missing, cannot send email");
      return new Response(JSON.stringify({ sent: false, reason: "no_wix_config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use a different Wix endpoint for notifications
    // The base URL should be like https://www.site.com/_functions/sendOtp
    // We'll call https://www.site.com/_functions/sendNotification
    const baseUrl = WIX_SITE_URL.replace(/\/sendOtp\/?$/, "");
    const notifyUrl = `${baseUrl}/sendNotification`;

    console.log(`[Notify] Sending ${event_type} notification to ${cleanEmail} via ${notifyUrl}`);

    try {
      const wixRes = await fetch(notifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          subject,
          message,
          request_type: requestType,
          status,
          event_type,
          secret: WIX_OTP_SECRET,
        }),
      });

      const wixBody = await wixRes.text();
      console.log(`[Notify] Wix response: ${wixRes.status} ${wixBody}`);

      if (!wixRes.ok) {
        console.error("[Notify] Wix relay failed:", wixRes.status, wixBody);
        return new Response(JSON.stringify({ sent: false, reason: "wix_error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (wixErr) {
      console.error("[Notify] Error calling Wix:", wixErr);
      return new Response(JSON.stringify({ sent: false, reason: "wix_error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Notify] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

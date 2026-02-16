import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token
    const { data: portalToken, error: tokenError } = await supabase
      .from("portal_tokens")
      .select("*")
      .eq("token", token)
      .eq("revoked", false)
      .maybeSingle();

    if (tokenError || !portalToken) {
      return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(portalToken.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This link has expired" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contactId = portalToken.contact_id;

    // Fetch all portal data in parallel
    const [contactRes, accountsRes, storehousesRes, auditRes] = await Promise.all([
      supabase.from("contacts").select("id, first_name, last_name, full_name, governance_status, fiduciary_entity, quiet_period_start_date, google_drive_url, vineyard_ebitda, vineyard_operating_income, vineyard_balance_sheet_summary").eq("id", contactId).maybeSingle(),
      supabase.from("vineyard_accounts").select("*").eq("contact_id", contactId).order("created_at"),
      supabase.from("storehouses").select("*").eq("contact_id", contactId).order("storehouse_number"),
      supabase.from("sovereignty_audit_trail").select("*").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(50),
    ]);

    return new Response(JSON.stringify({
      contact: contactRes.data,
      vineyard_accounts: accountsRes.data || [],
      storehouses: storehousesRes.data || [],
      audit_trail: auditRes.data || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Portal validate error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

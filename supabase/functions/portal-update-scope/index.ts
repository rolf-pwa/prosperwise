import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { portal_token, asset_id, asset_table, new_scope } = await req.json();

    if (!portal_token || !asset_id || !asset_table || !new_scope) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate table and scope
    if (!["vineyard_accounts", "storehouses"].includes(asset_table)) {
      return new Response(JSON.stringify({ error: "Invalid table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["private", "household_shared", "family_shared"].includes(new_scope)) {
      return new Response(JSON.stringify({ error: "Invalid scope" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate portal token
    const { data: portalToken, error: tokenError } = await supabase
      .from("portal_tokens")
      .select("contact_id")
      .eq("token", portal_token)
      .eq("revoked", false)
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();

    if (tokenError || !portalToken) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the asset belongs to this contact
    const { data: asset, error: assetError } = await supabase
      .from(asset_table)
      .select("id, contact_id")
      .eq("id", asset_id)
      .eq("contact_id", portalToken.contact_id)
      .maybeSingle();

    if (assetError || !asset) {
      return new Response(JSON.stringify({ error: "Asset not found or access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the scope
    const { error: updateError } = await supabase
      .from(asset_table)
      .update({ visibility_scope: new_scope })
      .eq("id", asset_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update scope" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Portal update scope error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

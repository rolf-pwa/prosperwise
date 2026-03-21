import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!apiKey || apiKey !== Deno.env.get("EXTERNAL_API_KEY")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [households, contacts, corporations, shareholders] = await Promise.all([
      supabase.from("households").select("*"),
      supabase.from("contacts").select("*"),
      supabase.from("corporations").select("*"),
      supabase.from("shareholders").select("*"),
    ]);

    // Also fetch related data
    const [families, vineyardAccounts, storehouses, corpVineyard, corpShareholders, portalTokens, portalRequests, auditTrail] = await Promise.all([
      supabase.from("families").select("*"),
      supabase.from("vineyard_accounts").select("*"),
      supabase.from("storehouses").select("*"),
      supabase.from("corporate_vineyard_accounts").select("*"),
      supabase.from("corporate_shareholders").select("*"),
      supabase.from("portal_tokens").select("id, contact_id, created_by, expires_at, revoked, created_at"),
      supabase.from("portal_requests").select("*, messages:portal_request_messages(*)"),
      supabase.from("sovereignty_audit_trail").select("*"),
    ]);

    return new Response(JSON.stringify({
      households: households.data || [],
      contacts: contacts.data || [],
      corporations: corporations.data || [],
      shareholders: shareholders.data || [],
      families: families.data || [],
      vineyard_accounts: vineyardAccounts.data || [],
      storehouses: storehouses.data || [],
      corporate_vineyard_accounts: corpVineyard.data || [],
      corporate_shareholders: corpShareholders.data || [],
      portal_tokens: portalTokens.data || [],
      portal_requests: portalRequests.data || [],
      audit_trail: auditTrail.data || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Export error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

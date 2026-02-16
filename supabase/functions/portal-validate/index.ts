import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

async function getValidGoogleToken(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  if (new Date(data.token_expiry) <= new Date()) {
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: data.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const tokens = await res.json();
      if (tokens.error) return null;

      const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      await supabase
        .from("google_tokens")
        .update({ access_token: tokens.access_token, token_expiry: newExpiry })
        .eq("user_id", userId);

      return tokens.access_token;
    } catch {
      return null;
    }
  }

  return data.access_token;
}

async function fetchCalendarEvents(accessToken: string, contactEmail: string): Promise<any[]> {
  try {
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 86400000).toISOString();

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        maxResults: "20",
        singleEvents: "true",
        orderBy: "startTime",
        q: contactEmail,
      }),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!calRes.ok) return [];

    const data = await calRes.json();
    // Filter to only events where the contact is an attendee
    return (data.items || []).filter((event: any) =>
      event.attendees?.some((a: any) =>
        a.email?.toLowerCase() === contactEmail.toLowerCase()
      ) ||
      event.organizer?.email?.toLowerCase() === contactEmail.toLowerCase() ||
      event.creator?.email?.toLowerCase() === contactEmail.toLowerCase()
    );
  } catch {
    return [];
  }
}

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
    const advisorUserId = portalToken.created_by;

    // Fetch all portal data in parallel
    const [contactRes, accountsRes, storehousesRes, auditRes] = await Promise.all([
      supabase.from("contacts").select("id, first_name, last_name, full_name, email, governance_status, fiduciary_entity, quiet_period_start_date, google_drive_url, sidedrawer_url, asana_url, ia_financial_url, vineyard_ebitda, vineyard_operating_income, vineyard_balance_sheet_summary, family_id, household_id, family_role, is_minor").eq("id", contactId).maybeSingle(),
      supabase.from("vineyard_accounts").select("*").eq("contact_id", contactId).order("created_at"),
      supabase.from("storehouses").select("*").eq("contact_id", contactId).order("storehouse_number"),
      supabase.from("sovereignty_audit_trail").select("*").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(50),
    ]);

    // Fetch family, household, and household members if available
    let family = null;
    let household = null;
    let householdMembers: any[] = [];

    const familyId = contactRes.data?.family_id;
    const householdId = contactRes.data?.household_id;

    if (familyId || householdId) {
      const extraQueries: Promise<any>[] = [];
      
      if (familyId) {
        extraQueries.push(
          supabase.from("families").select("id, name, charter_document_url, fee_tier, total_family_assets").eq("id", familyId).maybeSingle()
        );
      } else {
        extraQueries.push(Promise.resolve({ data: null }));
      }

      if (householdId) {
        extraQueries.push(
          supabase.from("households").select("id, label, address").eq("id", householdId).maybeSingle()
        );
        // Get other members in the same household
        extraQueries.push(
          supabase.from("contacts").select("id, first_name, last_name, family_role, is_minor").eq("household_id", householdId).neq("id", contactId)
        );
      } else {
        extraQueries.push(Promise.resolve({ data: null }));
        extraQueries.push(Promise.resolve({ data: [] }));
      }

      const [familyRes, householdRes, membersRes] = await Promise.all(extraQueries);
      family = familyRes.data;
      household = householdRes.data;
      householdMembers = membersRes.data || [];
    }

    // Fetch calendar events if contact has an email
    let meetings: any[] = [];
    const contactEmail = contactRes.data?.email;
    if (contactEmail) {
      const googleToken = await getValidGoogleToken(supabase, advisorUserId);
      if (googleToken) {
        meetings = await fetchCalendarEvents(googleToken, contactEmail);
      }
    }

    return new Response(JSON.stringify({
      contact: contactRes.data,
      vineyard_accounts: accountsRes.data || [],
      storehouses: storehousesRes.data || [],
      audit_trail: auditRes.data || [],
      meetings,
      family,
      household,
      household_members: householdMembers,
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

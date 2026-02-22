import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Fetch vineyard + storehouse data for a list of contact IDs
async function fetchAssetsForContacts(supabase: any, contactIds: string[]) {
  if (contactIds.length === 0) return { vineyard: [], storehouses: [] };
  const [vRes, sRes] = await Promise.all([
    supabase.from("vineyard_accounts").select("*").in("contact_id", contactIds).order("created_at"),
    supabase.from("storehouses").select("*").in("contact_id", contactIds).order("storehouse_number"),
  ]);
  return { vineyard: vRes.data || [], storehouses: sRes.data || [] };
}

// Build hierarchy data based on family_role
async function buildHierarchy(supabase: any, contact: any) {
  const role = contact.family_role;
  const familyId = contact.family_id;
  const householdId = contact.household_id;

  if (role === "head_of_family" && familyId) {
    const { data: households } = await supabase
      .from("households")
      .select("id, label, address")
      .eq("family_id", familyId)
      .order("label");

    const householdIds = (households || []).map((h: any) => h.id);

    const { data: allMembers } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, family_role, is_minor, household_id, email")
      .in("household_id", householdIds.length > 0 ? householdIds : ["__none__"]);

    const memberIds = (allMembers || []).map((m: any) => m.id);
    const assets = await fetchAssetsForContacts(supabase, memberIds);

    const householdsWithMembers = (households || []).map((hh: any) => {
      const members = (allMembers || []).filter((m: any) => m.household_id === hh.id);
      return {
        ...hh,
        members: members.map((m: any) => ({
          ...m,
          vineyard_accounts: assets.vineyard.filter((v: any) => v.contact_id === m.id),
          storehouses: assets.storehouses.filter((s: any) => s.contact_id === m.id),
        })),
      };
    });

    return { level: "family", households: householdsWithMembers };
  }

  if ((role === "head_of_family" || role === "spouse") && householdId) {
    const { data: members } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, family_role, is_minor, email")
      .eq("household_id", householdId)
      .neq("id", contact.id);

    const memberIds = (members || []).map((m: any) => m.id);
    const assets = await fetchAssetsForContacts(supabase, memberIds);

    return {
      level: role === "head_of_family" ? "family" : "household",
      members: (members || []).map((m: any) => ({
        ...m,
        vineyard_accounts: assets.vineyard.filter((v: any) => v.contact_id === m.id),
        storehouses: assets.storehouses.filter((s: any) => s.contact_id === m.id),
      })),
    };
  }

  return { level: "individual" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, email, code } = await req.json();

    if (action === "send") {
      if (!email || typeof email !== "string") {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanEmail = email.trim().toLowerCase();

      // Find contact by email
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, first_name, email")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (!contact) {
        // Don't reveal whether email exists — always say "sent"
        return new Response(JSON.stringify({ sent: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit: max 3 OTPs per email per hour
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count } = await supabase
        .from("portal_otps")
        .select("*", { count: "exact", head: true })
        .eq("email", cleanEmail)
        .gte("created_at", oneHourAgo);

      if ((count ?? 0) >= 3) {
        return new Response(JSON.stringify({ sent: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      await supabase.from("portal_otps").insert({
        email: cleanEmail,
        code: otp,
        contact_id: contact.id,
        expires_at: expiresAt,
      });

      // Send OTP email via Wix triggered email relay
      const WIX_SITE_URL = Deno.env.get("WIX_SITE_URL");
      const WIX_OTP_SECRET = Deno.env.get("WIX_OTP_SECRET");

      if (WIX_SITE_URL && WIX_OTP_SECRET) {
        try {
          const wixRes = await fetch(WIX_SITE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: cleanEmail,
              code: otp,
              secret: WIX_OTP_SECRET,
            }),
          });
          if (!wixRes.ok) {
            const errBody = await wixRes.text();
            console.error("[WixRelay] Failed to send OTP:", wixRes.status, errBody);
          }
        } catch (wixErr) {
          console.error("[WixRelay] Error calling Wix endpoint:", wixErr);
        }
      } else {
        // Fallback: log OTP for development
        console.log(`[DEV] OTP for ${cleanEmail}: ${otp}`);
      }

      return new Response(JSON.stringify({ sent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (!email || !code) {
        return new Response(JSON.stringify({ error: "Email and code required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanEmail = email.trim().toLowerCase();

      const { data: otp } = await supabase
        .from("portal_otps")
        .select("*")
        .eq("email", cleanEmail)
        .eq("code", code)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otp) {
        return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark as verified
      await supabase.from("portal_otps").update({ verified: true }).eq("id", otp.id);

      const contactId = otp.contact_id;

      // Create a portal token so the client can use it for subsequent API calls
      const { data: newToken } = await supabase
        .from("portal_tokens")
        .insert({
          contact_id: contactId,
          created_by: contactId, // self-issued via OTP
        })
        .select("token")
        .single();

      // Now load portal data
      const [contactRes, accountsRes, storehousesRes, auditRes] = await Promise.all([
        supabase.from("contacts").select("id, first_name, last_name, full_name, email, governance_status, fiduciary_entity, quiet_period_start_date, google_drive_url, sidedrawer_url, asana_url, ia_financial_url, vineyard_ebitda, vineyard_operating_income, vineyard_balance_sheet_summary, family_id, household_id, family_role, is_minor").eq("id", contactId).maybeSingle(),
        supabase.from("vineyard_accounts").select("*").eq("contact_id", contactId).order("created_at"),
        supabase.from("storehouses").select("*").eq("contact_id", contactId).order("storehouse_number"),
        supabase.from("sovereignty_audit_trail").select("*").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(50),
      ]);

      let family = null;
      let household = null;
      let householdMembers: any[] = [];

      const familyId = contactRes.data?.family_id;
      const householdId = contactRes.data?.household_id;

      if (familyId || householdId) {
        const extraQueries: Promise<any>[] = [];
        if (familyId) {
          extraQueries.push(supabase.from("families").select("id, name, charter_document_url, fee_tier, total_family_assets").eq("id", familyId).maybeSingle());
        } else {
          extraQueries.push(Promise.resolve({ data: null }));
        }
        if (householdId) {
          extraQueries.push(supabase.from("households").select("id, label, address").eq("id", householdId).maybeSingle());
          extraQueries.push(supabase.from("contacts").select("id, first_name, last_name, family_role, is_minor").eq("household_id", householdId).neq("id", contactId));
        } else {
          extraQueries.push(Promise.resolve({ data: null }));
          extraQueries.push(Promise.resolve({ data: [] }));
        }
        const [familyRes, householdRes, membersRes] = await Promise.all(extraQueries);
        family = familyRes.data;
        household = householdRes.data;
        householdMembers = membersRes.data || [];
      }

      // Build hierarchy data based on role
      const hierarchy = contactRes.data ? await buildHierarchy(supabase, contactRes.data) : { level: "individual" };

      return new Response(JSON.stringify({
        portal_token: newToken?.token || null,
        contact: contactRes.data,
        vineyard_accounts: accountsRes.data || [],
        storehouses: storehousesRes.data || [],
        audit_trail: auditRes.data || [],
        meetings: [],
        family,
        household,
        household_members: householdMembers,
        hierarchy,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "google-auth") {
      // Google OAuth portal login — look up contact by email
      if (!email || typeof email !== "string") {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanEmail = email.trim().toLowerCase();

      const { data: contact } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, full_name, email, governance_status, fiduciary_entity, quiet_period_start_date, google_drive_url, sidedrawer_url, asana_url, ia_financial_url, vineyard_ebitda, vineyard_operating_income, vineyard_balance_sheet_summary, family_id, household_id, family_role, is_minor")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (!contact) {
        return new Response(JSON.stringify({ error: "No account found for this email" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create a portal token for the session
      const { data: newToken } = await supabase
        .from("portal_tokens")
        .insert({
          contact_id: contact.id,
          created_by: contact.id,
        })
        .select("token")
        .single();

      // Load portal data (same as OTP verify flow)
      const [accountsRes, storehousesRes, auditRes] = await Promise.all([
        supabase.from("vineyard_accounts").select("*").eq("contact_id", contact.id).order("created_at"),
        supabase.from("storehouses").select("*").eq("contact_id", contact.id).order("storehouse_number"),
        supabase.from("sovereignty_audit_trail").select("*").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(50),
      ]);

      let family = null;
      let household = null;
      let householdMembers: any[] = [];

      if (contact.family_id || contact.household_id) {
        const extraQueries: Promise<any>[] = [];
        if (contact.family_id) {
          extraQueries.push(supabase.from("families").select("id, name, charter_document_url, fee_tier, total_family_assets").eq("id", contact.family_id).maybeSingle());
        } else {
          extraQueries.push(Promise.resolve({ data: null }));
        }
        if (contact.household_id) {
          extraQueries.push(supabase.from("households").select("id, label, address").eq("id", contact.household_id).maybeSingle());
          extraQueries.push(supabase.from("contacts").select("id, first_name, last_name, family_role, is_minor").eq("household_id", contact.household_id).neq("id", contact.id));
        } else {
          extraQueries.push(Promise.resolve({ data: null }));
          extraQueries.push(Promise.resolve({ data: [] }));
        }
        const [familyRes, householdRes, membersRes] = await Promise.all(extraQueries);
        family = familyRes.data;
        household = householdRes.data;
        householdMembers = membersRes.data || [];
      }

      const hierarchy = await buildHierarchy(supabase, contact);

      return new Response(JSON.stringify({
        portal_token: newToken?.token || null,
        contact,
        vineyard_accounts: accountsRes.data || [],
        storehouses: storehousesRes.data || [],
        audit_trail: auditRes.data || [],
        meetings: [],
        family,
        household,
        household_members: householdMembers,
        hierarchy,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Portal OTP error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

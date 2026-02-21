import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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

      // Send OTP email via Supabase Auth admin (using built-in SMTP)
      // We use a simple approach: send via the Supabase built-in email
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "ProsperWise <portal@prosperwise.ca>",
            to: [cleanEmail],
            subject: "Your Portal Access Code",
            html: `
              <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #1a1a2e; margin-bottom: 8px;">Sovereign Portal Access</h2>
                <p style="color: #555; font-size: 14px;">Hi ${contact.first_name},</p>
                <p style="color: #555; font-size: 14px;">Your one-time access code is:</p>
                <div style="background: #f4f4f8; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">${otp}</span>
                </div>
                <p style="color: #888; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #aaa; font-size: 11px;">ProsperWise Advisors — Your Personal CFO</p>
              </div>
            `,
          }),
        });
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

      // Create a portal token so the client can use it for subsequent API calls (e.g. Asana tasks)
      const { data: newToken } = await supabase
        .from("portal_tokens")
        .insert({
          contact_id: contactId,
          created_by: contactId, // self-issued via OTP
        })
        .select("token")
        .single();

      // Now load portal data (same as portal-validate)

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

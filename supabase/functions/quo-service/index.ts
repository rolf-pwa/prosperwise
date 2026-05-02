import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkOutboundPii, piiBlockMessage } from "../_shared/pii-shield.ts";

const ALLOWED_ORIGINS = [
  "https://prosperwise.lovable.app",
  "https://app.prosperwise.ca",
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

const QUO_API_KEY = Deno.env.get("QUO_API_KEY")!;
const QUO_PHONE_NUMBER_ID = Deno.env.get("QUO_DEFAULT_PHONE_NUMBER_ID")!;
const QUO_BASE_URL = "https://api.openphone.com/v1";

async function quoFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${QUO_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Authorization": QUO_API_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Quo API ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function normalizePhone(phone: string): string {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action } = body;

    // ---- sendSms ----
    if (action === "sendSms") {
      const { contactId, to, content } = body;
      if (!to || !content) {
        return new Response(JSON.stringify({ error: "Missing 'to' or 'content'" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // PII Shield (Glass Box compliance)
      const piiCheck = checkOutboundPii(content);
      if (piiCheck.blocked) {
        // Log the blocked attempt for audit
        await adminClient.from("quo_messages").insert({
          contact_id: contactId || null,
          direction: "outbound",
          from_number: "blocked",
          to_number: normalizePhone(to),
          body: "[REDACTED — PII BLOCKED]",
          status: "blocked",
          sent_by: userId,
          portal_visible: false,
          pii_blocked: true,
          pii_block_reason: piiCheck.reason,
        });
        return new Response(JSON.stringify({
          error: piiBlockMessage(piiCheck.reason || "Sensitive content"),
          blocked: true, reason: piiCheck.reason,
        }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const toNum = normalizePhone(to);
      const result = await quoFetch("/messages", {
        method: "POST",
        body: JSON.stringify({
          from: QUO_PHONE_NUMBER_ID,
          to: [toNum],
          content,
        }),
      });

      const msg = result?.data || result;
      await adminClient.from("quo_messages").insert({
        quo_message_id: msg?.id,
        contact_id: contactId || null,
        direction: "outbound",
        from_number: msg?.from || QUO_PHONE_NUMBER_ID,
        to_number: toNum,
        body: content,
        status: msg?.status || "sent",
        sent_by: userId,
        portal_visible: false,
        occurred_at: msg?.createdAt || new Date().toISOString(),
      });

      return new Response(JSON.stringify({ success: true, message: msg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- listMessages ----
    if (action === "listMessages") {
      const { contactId } = body;
      if (!contactId) {
        return new Response(JSON.stringify({ error: "Missing contactId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("quo_messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return new Response(JSON.stringify({ messages: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- listCalls ----
    if (action === "listCalls") {
      const { contactId } = body;
      if (!contactId) {
        return new Response(JSON.stringify({ error: "Missing contactId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("quo_calls")
        .select("*")
        .eq("contact_id", contactId)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return new Response(JSON.stringify({ calls: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- inbox (global, all contacts) ----
    if (action === "inbox") {
      const { limit = 100 } = body;
      const [msgRes, callRes] = await Promise.all([
        supabase.from("quo_messages").select("*").order("occurred_at", { ascending: false }).limit(limit),
        supabase.from("quo_calls").select("*").order("occurred_at", { ascending: false }).limit(limit),
      ]);
      if (msgRes.error) throw msgRes.error;
      if (callRes.error) throw callRes.error;

      const contactIds = Array.from(new Set([
        ...(msgRes.data || []).map((m: any) => m.contact_id).filter(Boolean),
        ...(callRes.data || []).map((c: any) => c.contact_id).filter(Boolean),
      ]));
      let contactsById: Record<string, any> = {};
      if (contactIds.length) {
        const { data: contacts } = await adminClient
          .from("contacts")
          .select("id, first_name, last_name, phone")
          .in("id", contactIds);
        contactsById = Object.fromEntries((contacts || []).map((c: any) => [c.id, c]));
      }

      return new Response(JSON.stringify({
        messages: msgRes.data || [],
        calls: callRes.data || [],
        contacts: contactsById,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- togglePortalVisible ----
    if (action === "togglePortalVisible") {
      const { recordType, recordId, visible } = body;
      const table = recordType === "call" ? "quo_calls" : "quo_messages";
      const { error } = await adminClient
        .from(table)
        .update({ portal_visible: !!visible })
        .eq("id", recordId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- syncContact (push Sanctuary contact → Quo, name+phone only) ----
    if (action === "syncContact") {
      const { contactId } = body;
      const { data: contact, error: cErr } = await adminClient
        .from("contacts").select("id, first_name, last_name, phone").eq("id", contactId).single();
      if (cErr || !contact?.phone) {
        return new Response(JSON.stringify({ error: "Contact has no phone" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = {
        defaultFields: {
          firstName: contact.first_name || "",
          lastName: contact.last_name || "",
          phoneNumbers: [{ name: "Mobile", value: normalizePhone(contact.phone) }],
        },
      };

      const { data: existing } = await adminClient
        .from("quo_contact_sync").select("quo_contact_id").eq("contact_id", contactId).maybeSingle();

      let quoContact: any;
      if (existing?.quo_contact_id) {
        quoContact = await quoFetch(`/contacts/${existing.quo_contact_id}`, {
          method: "PATCH", body: JSON.stringify(payload),
        });
      } else {
        quoContact = await quoFetch("/contacts", {
          method: "POST", body: JSON.stringify(payload),
        });
      }

      const quoId = (quoContact?.data || quoContact)?.id;
      if (quoId) {
        await adminClient.from("quo_contact_sync").upsert({
          contact_id: contactId,
          quo_contact_id: quoId,
          last_synced_at: new Date().toISOString(),
          sync_direction: "bidirectional",
        }, { onConflict: "contact_id" });
      }

      return new Response(JSON.stringify({ success: true, quoContactId: quoId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[quo-service] error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

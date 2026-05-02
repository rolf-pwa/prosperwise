import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// PUBLIC endpoint — Quo posts here. HMAC signature is the only auth.

const QUO_SIGNING_SECRET = Deno.env.get("QUO_WEBHOOK_SIGNING_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, openphone-signature, x-openphone-signature",
};

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !QUO_SIGNING_SECRET) return false;

  // OpenPhone signature header format: "hmac;1;<timestamp>;<base64-signature>"
  // We support both that format and a plain hex/base64 signature for resilience.
  let providedSig = signatureHeader.trim();
  let timestamp = "";
  if (providedSig.includes(";")) {
    const parts = providedSig.split(";");
    timestamp = parts[2] || "";
    providedSig = parts[3] || "";
  }

  const signedPayload = timestamp ? `${timestamp}.${rawBody}` : rawBody;

  const enc = new TextEncoder();
  // OpenPhone provides the signing key as base64; fall back to raw if decode fails
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(QUO_SIGNING_SECRET), (c) => c.charCodeAt(0));
  } catch {
    keyBytes = enc.encode(QUO_SIGNING_SECRET);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(signedPayload));
  const sigBytes = new Uint8Array(sigBuf);
  const computedB64 = btoa(String.fromCharCode(...sigBytes));
  const computedHex = Array.from(sigBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  return providedSig === computedB64 || providedSig === computedHex;
}

async function findContactByPhone(admin: any, phone: string): Promise<string | null> {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").slice(-10); // last 10 digits
  const { data } = await admin
    .from("contacts")
    .select("id, phone")
    .not("phone", "is", null)
    .limit(500);
  for (const c of data || []) {
    const cd = (c.phone || "").replace(/\D/g, "").slice(-10);
    if (cd && cd === digits) return c.id;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const sigHeader =
    req.headers.get("openphone-signature") ||
    req.headers.get("x-openphone-signature") ||
    req.headers.get("openphone-signature-v2");

  const isValid = await verifySignature(rawBody, sigHeader);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch { payload = { raw: rawBody }; }

  const eventType = payload?.type || payload?.event || "unknown";
  const eventId = payload?.id || payload?.eventId || null;

  // Always log the event (even invalid) for forensic audit
  const { data: logRow } = await admin.from("quo_webhook_events").insert({
    event_type: eventType,
    quo_event_id: eventId,
    payload,
    signature_valid: isValid,
    processed: false,
  }).select("id").single();

  if (!isValid) {
    console.warn("[quo-webhook] invalid signature, rejecting");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const data = payload?.data?.object || payload?.data || payload;

    // ---- Messages ----
    if (eventType === "message.received" || eventType === "message.delivered") {
      const isInbound = eventType === "message.received";
      const fromNum = data?.from || "";
      const toNum = Array.isArray(data?.to) ? data.to[0] : (data?.to || "");
      const counterparty = isInbound ? fromNum : toNum;
      const contactId = await findContactByPhone(admin, counterparty);

      if (eventType === "message.received") {
        await admin.from("quo_messages").upsert({
          quo_message_id: data?.id,
          contact_id: contactId,
          direction: "inbound",
          from_number: fromNum,
          to_number: toNum,
          body: data?.body || data?.text || "",
          status: data?.status || "received",
          media_urls: data?.media || [],
          quo_user_id: data?.userId || null,
          portal_visible: false,
          occurred_at: data?.createdAt || new Date().toISOString(),
        }, { onConflict: "quo_message_id" });
      } else {
        // delivered → update status
        if (data?.id) {
          await admin.from("quo_messages")
            .update({ status: "delivered" })
            .eq("quo_message_id", data.id);
        }
      }
    }

    // ---- Calls ----
    else if (eventType === "call.completed") {
      const direction = data?.direction === "incoming" ? "inbound" : "outbound";
      const fromNum = data?.from || "";
      const toNum = Array.isArray(data?.to) ? data.to[0] : (data?.to || "");
      const counterparty = direction === "inbound" ? fromNum : toNum;
      const contactId = await findContactByPhone(admin, counterparty);

      await admin.from("quo_calls").upsert({
        quo_call_id: data?.id,
        contact_id: contactId,
        direction,
        from_number: fromNum,
        to_number: toNum,
        status: data?.status || "completed",
        duration_seconds: data?.duration || 0,
        quo_user_id: data?.userId || null,
        portal_visible: false,
        occurred_at: data?.completedAt || data?.createdAt || new Date().toISOString(),
      }, { onConflict: "quo_call_id" });
    }
    else if (eventType === "call.recording.completed") {
      if (data?.callId) {
        await admin.from("quo_calls")
          .update({ recording_url: data?.media?.[0]?.url || data?.url || null })
          .eq("quo_call_id", data.callId);
      }
    }
    else if (eventType === "call.transcript.completed") {
      const callId = data?.callId || data?.id;
      const dialogue = data?.dialogue || data?.segments || [];
      const transcript = Array.isArray(dialogue)
        ? dialogue.map((d: any) => `${d.identifier || d.speaker || "Speaker"}: ${d.content || d.text || ""}`).join("\n")
        : (data?.transcript || "");
      if (callId) {
        await admin.from("quo_calls").update({ transcript }).eq("quo_call_id", callId);
      }
    }
    else if (eventType === "call.summary.completed") {
      const callId = data?.callId || data?.id;
      const summary = data?.summary?.summary || data?.summary || "";
      const nextSteps = Array.isArray(data?.summary?.nextSteps)
        ? data.summary.nextSteps.join("\n")
        : (data?.nextSteps || "");
      if (callId) {
        await admin.from("quo_calls")
          .update({ summary, next_steps: nextSteps })
          .eq("quo_call_id", callId);
      }
    }

    // ---- Contacts (two-way sync from Quo) ----
    else if (eventType === "contact.created" || eventType === "contact.updated") {
      const quoContactId = data?.id;
      if (quoContactId) {
        const phoneList = data?.defaultFields?.phoneNumbers || [];
        const firstPhone = phoneList[0]?.value || "";
        const contactId = await findContactByPhone(admin, firstPhone);
        if (contactId) {
          await admin.from("quo_contact_sync").upsert({
            contact_id: contactId,
            quo_contact_id: quoContactId,
            last_synced_at: new Date().toISOString(),
            sync_direction: "bidirectional",
          }, { onConflict: "contact_id" });
        }
      }
    }

    if (logRow?.id) {
      await admin.from("quo_webhook_events")
        .update({ processed: true }).eq("id", logRow.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[quo-webhook] processing error:", err);
    if (logRow?.id) {
      await admin.from("quo_webhook_events")
        .update({ processing_error: err.message || String(err) }).eq("id", logRow.id);
    }
    return new Response(JSON.stringify({ error: err.message || "Processing failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

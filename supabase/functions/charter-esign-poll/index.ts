import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

async function getValidTokenForUser(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.token_expiry) <= new Date()) {
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
    await supabaseAdmin
      .from("google_tokens")
      .update({ access_token: tokens.access_token, token_expiry: newExpiry })
      .eq("user_id", userId);
    return tokens.access_token;
  }
  return data.access_token;
}

async function pollOne(supabaseAdmin: any, charter: any): Promise<{ id: string; status: string; note?: string }> {
  const docId = charter.esign_doc_id;
  const userId = charter.esign_initiated_by;
  if (!docId || !userId) return { id: charter.id, status: "skipped", note: "missing doc_id or initiator" };

  const accessToken = await getValidTokenForUser(supabaseAdmin, userId);
  if (!accessToken) {
    return { id: charter.id, status: "skipped", note: "initiator has no valid Google token" };
  }

  // Fetch Drive file metadata including eSignatureMetadata
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${docId}?fields=id,name,modifiedTime,eSignatureMetadata`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  if (!metaRes.ok) {
    const errMsg = meta.error?.message || "Drive metadata fetch failed";
    await supabaseAdmin
      .from("sovereignty_charters")
      .update({
        esign_last_checked_at: new Date().toISOString(),
        esign_error: errMsg,
      })
      .eq("id", charter.id);
    return { id: charter.id, status: "error", note: errMsg };
  }

  const esign = meta.eSignatureMetadata;
  const status = esign?.status || esign?.signatureStatus; // status may be e.g. "COMPLETED" or "IN_PROGRESS"

  if (status === "COMPLETED") {
    // Export signed PDF
    const exportRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=application/pdf`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    let storedPath: string | null = null;
    if (exportRes.ok) {
      const pdfBytes = new Uint8Array(await exportRes.arrayBuffer());
      const path = `signed-charters/${charter.contact_id}/${charter.id}-${Date.now()}.pdf`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("charter-source-uploads")
        .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (!upErr) storedPath = path;
      else console.error("PDF upload failed:", upErr);
    } else {
      console.error("PDF export failed:", await exportRes.text());
    }

    const ratifiedAt = new Date().toISOString();
    await supabaseAdmin
      .from("sovereignty_charters")
      .update({
        esign_status: "ratified",
        esign_signed_at: ratifiedAt,
        esign_signed_pdf_path: storedPath,
        esign_last_checked_at: ratifiedAt,
        esign_error: null,
        draft_status: "ratified",
        ratified_at: ratifiedAt,
        ratified_by: userId,
        footer_status: "Ratified / Sovereign phase",
      })
      .eq("id", charter.id);

    // Link in contact charter_url if not set
    await supabaseAdmin
      .from("contacts")
      .update({ charter_url: `/sovereignty-charter/contact/${charter.contact_id}` })
      .eq("id", charter.contact_id);

    return { id: charter.id, status: "ratified" };
  }

  // Still pending
  await supabaseAdmin
    .from("sovereignty_charters")
    .update({ esign_last_checked_at: new Date().toISOString(), esign_error: null })
    .eq("id", charter.id);
  return { id: charter.id, status: "pending", note: status || "no esign metadata yet" };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Allow optional charter_id to poll a single record (for manual refresh)
    let charterId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.charter_id) charterId = String(body.charter_id);
      } catch {
        // no body, treat as cron run
      }
    }

    let query = supabaseAdmin
      .from("sovereignty_charters")
      .select("id, contact_id, esign_doc_id, esign_initiated_by, esign_status")
      .eq("esign_status", "sent")
      .not("esign_doc_id", "is", null)
      .limit(50);

    if (charterId) {
      query = supabaseAdmin
        .from("sovereignty_charters")
        .select("id, contact_id, esign_doc_id, esign_initiated_by, esign_status")
        .eq("id", charterId);
    }

    const { data: charters, error } = await query;
    if (error) throw new Error(error.message);

    const results = [];
    for (const c of charters || []) {
      try {
        results.push(await pollOne(supabaseAdmin, c));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`pollOne failed for ${c.id}:`, msg);
        results.push({ id: c.id, status: "error", note: msg });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, checked: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("charter-esign-poll error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Vault Service — Proof of Concept
// Proxies Google Drive folder listings and file content through Supabase
// so clients never see Drive directly. Uses the firm's Ghost User Google token.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

async function getValidGoogleToken(supabaseAdmin: any): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("google_tokens")
    .select("*")
    .limit(1)
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
    if (tokens.error) {
      console.error("[Vault] token refresh failed", tokens);
      return null;
    }
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("google_tokens")
      .update({ access_token: tokens.access_token, token_expiry: newExpiry })
      .eq("user_id", data.user_id);
    return tokens.access_token;
  }
  return data.access_token;
}

const GOOGLE_NATIVE = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
]);

function googleExportMime(mime: string) {
  if (mime === "application/vnd.google-apps.spreadsheet")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  // Docs + Slides → PDF for inline preview
  return "application/pdf";
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  // Action can be in query (?action=) or in JSON body
  let action = url.searchParams.get("action") ?? "";
  let body: any = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
      action = body.action ?? action;
    } catch {
      /* no body */
    }
  }

  // Staff auth gate (POC). Portal session validation comes in phase 2.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const accessToken = await getValidGoogleToken(supabaseAdmin);
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "no_google_token", hint: "Connect Google Workspace first." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  try {
    if (action === "listFolder") {
      const folderId = body.folderId ?? url.searchParams.get("folderId");
      if (!folderId) {
        return new Response(JSON.stringify({ error: "folderId required" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
      const fields = encodeURIComponent("files(id,name,mimeType,size,modifiedTime,iconLink)");
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=200&orderBy=folder,name`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const driveJson = await driveRes.json();
      if (!driveRes.ok) {
        return new Response(JSON.stringify({ error: "drive_error", detail: driveJson }), {
          status: driveRes.status,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const folders = (driveJson.files ?? [])
        .filter((f: any) => f.mimeType === "application/vnd.google-apps.folder")
        .map((f: any) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime }));
      const files = (driveJson.files ?? [])
        .filter((f: any) => f.mimeType !== "application/vnd.google-apps.folder")
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size ? Number(f.size) : null,
          modifiedTime: f.modifiedTime,
        }));
      return new Response(JSON.stringify({ folders, files }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "streamFile") {
      const fileId = body.fileId ?? url.searchParams.get("fileId");
      const disposition = url.searchParams.get("disposition") ?? "inline";
      if (!fileId) {
        return new Response(JSON.stringify({ error: "fileId required" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      // Get metadata first to know mime + name
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const meta = await metaRes.json();
      if (!metaRes.ok) {
        return new Response(JSON.stringify({ error: "drive_meta_error", detail: meta }), {
          status: metaRes.status,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      let downloadUrl: string;
      let outMime = meta.mimeType;
      let outName = meta.name;

      if (GOOGLE_NATIVE.has(meta.mimeType)) {
        outMime = googleExportMime(meta.mimeType);
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(outMime)}`;
        if (outMime === "application/pdf" && !outName.toLowerCase().endsWith(".pdf")) {
          outName = `${outName}.pdf`;
        }
      } else {
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      }

      const dlRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!dlRes.ok) {
        const text = await dlRes.text();
        return new Response(JSON.stringify({ error: "drive_download_error", detail: text }), {
          status: dlRes.status,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const headers: Record<string, string> = {
        ...cors,
        "Content-Type": outMime || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${outName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      };
      const len = dlRes.headers.get("Content-Length");
      if (len) headers["Content-Length"] = len;

      return new Response(dlRes.body, { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "unknown_action", action }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[Vault] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

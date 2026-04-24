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
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
];

class InsufficientScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientScopeError";
  }
}

async function getValidToken(supabaseAdmin: any, userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    throw new InsufficientScopeError("Google not connected. Please reconnect with Drive + Docs access in Settings → Google.");
  }
  const grantedScopes: string[] = Array.isArray(data.scopes) ? data.scopes : [];
  const missing = REQUIRED_SCOPES.filter((s) => !grantedScopes.includes(s));
  if (missing.length > 0) {
    throw new InsufficientScopeError(
      "Your Google connection is missing required permissions for Docs and Drive. Please go to Settings → Google, disconnect, and reconnect to grant the new permissions.",
    );
  }
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
    if (tokens.error) throw new Error(`Token refresh failed: ${tokens.error}`);
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("google_tokens")
      .update({ access_token: tokens.access_token, token_expiry: newExpiry })
      .eq("user_id", userId);
    return tokens.access_token;
  }
  return data.access_token;
}

function fmtCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function buildCharterMarkdown(charter: any, contact: any): string {
  const fullName = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || contact?.full_name || "Sovereign";
  const lines: string[] = [];
  lines.push(`# ${charter.title || "Sovereignty Charter"}`);
  if (charter.subtitle) lines.push(`*${charter.subtitle}*`);
  lines.push("");
  lines.push(`**Sovereign:** ${fullName}`);
  lines.push("");

  if (charter.intro_heading) lines.push(`## ${charter.intro_heading}`);
  if (charter.intro_callout) lines.push(`> ${charter.intro_callout}`);
  if (charter.intro_note) lines.push(charter.intro_note);
  lines.push("");

  if (charter.mission_of_capital) {
    lines.push("## Mission of Capital");
    lines.push(charter.mission_of_capital);
    lines.push("");
  }
  if (charter.vision_20_year) {
    lines.push("## 20-Year Vision");
    lines.push(charter.vision_20_year);
    lines.push("");
  }
  if (charter.primary_goal) {
    lines.push("## Primary Goal");
    lines.push(charter.primary_goal);
    lines.push("");
  }
  if (charter.long_term_strategy) {
    lines.push("## Long-Term Strategy");
    lines.push(charter.long_term_strategy);
    lines.push("");
  }
  if (charter.governance_authority) {
    lines.push("## Governance Authority");
    lines.push(charter.governance_authority);
    lines.push("");
  }
  if (charter.fiduciary_alliance) {
    lines.push("## Fiduciary Alliance");
    lines.push(charter.fiduciary_alliance);
    lines.push("");
  }
  if (charter.quiet_period) {
    lines.push("## Quiet Period");
    lines.push(charter.quiet_period);
    lines.push("");
  }
  if (charter.architecture_intro) {
    lines.push("## Sovereignty Architecture");
    lines.push(charter.architecture_intro);
    lines.push("");
  }

  // Storehouses
  const sh: string[] = [];
  if (charter.storehouse_liquidity_value != null || charter.storehouse_liquidity_detail) {
    sh.push(`- **The Keep — Liquidity Reserve** (${fmtCurrency(charter.storehouse_liquidity_value)}): ${charter.storehouse_liquidity_detail || "—"}`);
  }
  if (charter.storehouse_strategic_value != null || charter.storehouse_strategic_detail) {
    sh.push(`- **The Armoury — Strategic Reserve** (${fmtCurrency(charter.storehouse_strategic_value)}): ${charter.storehouse_strategic_detail || "—"}`);
  }
  if (charter.storehouse_philanthropic_detail) {
    sh.push(`- **The Granary — Philanthropic Trust:** ${charter.storehouse_philanthropic_detail}`);
  }
  if (charter.storehouse_legacy_detail) {
    sh.push(`- **The Vault — Legacy Trust:** ${charter.storehouse_legacy_detail}`);
  }
  if (sh.length) {
    lines.push("## Storehouses");
    lines.push(...sh);
    lines.push("");
  }

  // Harvest
  if (charter.harvest_target_income || charter.harvest_yield_protocol || charter.harvest_spending_categories) {
    lines.push("## Harvest");
    if (charter.harvest_target_income) lines.push(`- **Target Income:** ${fmtCurrency(charter.harvest_target_income)}`);
    if (charter.harvest_yield_protocol) lines.push(`- **Yield Protocol:** ${charter.harvest_yield_protocol}`);
    if (charter.harvest_spending_categories) lines.push(`- **Spending Categories:** ${charter.harvest_spending_categories}`);
    lines.push("");
  }

  // Roles
  if (charter.roles_responsibilities) {
    lines.push("## Roles & Responsibilities");
    lines.push(charter.roles_responsibilities);
    lines.push("");
  }
  if (charter.professional_coordination) {
    lines.push("## Professional Coordination");
    lines.push(charter.professional_coordination);
    lines.push("");
  }
  if (charter.executor_primary || charter.executor_alternate || charter.succession_terms) {
    lines.push("## Succession");
    if (charter.executor_primary) lines.push(`- **Primary Executor:** ${charter.executor_primary}`);
    if (charter.executor_alternate) lines.push(`- **Alternate Executor:** ${charter.executor_alternate}`);
    if (charter.succession_terms) lines.push(charter.succession_terms);
    lines.push("");
  }

  if (charter.monitoring_cadence) {
    lines.push("## Monitoring Cadence");
    lines.push(charter.monitoring_cadence);
    lines.push("");
  }
  if (charter.withdrawal_safeguards) {
    lines.push("## Withdrawal Safeguards");
    lines.push(charter.withdrawal_safeguards);
    lines.push("");
  }
  if (charter.conflict_resolution) {
    lines.push("## Conflict Resolution");
    lines.push(charter.conflict_resolution);
    lines.push("");
  }

  // Custom sections
  const custom = Array.isArray(charter.custom_sections) ? charter.custom_sections : [];
  for (const section of custom) {
    if (!section) continue;
    if (section.title) lines.push(`## ${section.title}`);
    if (section.body) lines.push(section.body);
    lines.push("");
  }

  // Signatures
  const signers = Array.isArray(charter.ratification_signatories) ? charter.ratification_signatories : [];
  lines.push("---");
  lines.push("");
  lines.push("## Ratification");
  lines.push("");
  lines.push("By signing below, the parties ratify this Sovereignty Charter as the governing document for the family's wealth architecture.");
  lines.push("");
  if (signers.length === 0) {
    lines.push(`**Sovereign:** ${fullName}`);
    lines.push("");
    lines.push("Signature: __________________________   Date: __________");
    lines.push("");
    lines.push("**Personal CFO (ProsperWise):**");
    lines.push("");
    lines.push("Signature: __________________________   Date: __________");
  } else {
    for (const s of signers) {
      const name = s?.name || "—";
      const role = s?.role ? ` — ${s.role}` : "";
      lines.push(`**${name}**${role}`);
      lines.push("");
      lines.push("Signature: __________________________   Date: __________");
      lines.push("");
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("> *Use Google Docs → Tools → eSignature to add signature fields and send for signing. The system will auto-detect completion and ratify the charter.*");

  return lines.join("\n");
}

// Convert markdown lines to Google Docs batchUpdate requests
function buildBatchUpdateRequests(markdown: string): any[] {
  const requests: any[] = [];
  const lines = markdown.split("\n");
  let index = 1; // Body content starts at index 1

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    let text = line;
    let style: { namedStyleType?: string } = {};

    if (line.startsWith("# ")) {
      text = line.slice(2);
      style.namedStyleType = "TITLE";
    } else if (line.startsWith("## ")) {
      text = line.slice(3);
      style.namedStyleType = "HEADING_1";
    } else if (line.startsWith("### ")) {
      text = line.slice(4);
      style.namedStyleType = "HEADING_2";
    } else if (line.startsWith("> ")) {
      text = line.slice(2);
      style.namedStyleType = "NORMAL_TEXT";
    } else if (line.startsWith("- ")) {
      text = "• " + line.slice(2);
      style.namedStyleType = "NORMAL_TEXT";
    } else if (line === "---") {
      text = "────────────────────────────────────────";
      style.namedStyleType = "NORMAL_TEXT";
    }

    // Strip markdown bold/italic markers for clean Doc text
    text = text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");

    const insertText = text + "\n";
    requests.push({
      insertText: { location: { index }, text: insertText },
    });

    if (style.namedStyleType && style.namedStyleType !== "NORMAL_TEXT") {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + insertText.length },
          paragraphStyle: { namedStyleType: style.namedStyleType },
          fields: "namedStyleType",
        },
      });
    }

    index += insertText.length;
  }

  return requests;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { charter_id } = await req.json();
    if (!charter_id || typeof charter_id !== "string") {
      return new Response(JSON.stringify({ error: "charter_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: charter, error: charterErr } = await supabaseAdmin
      .from("sovereignty_charters")
      .select("*")
      .eq("id", charter_id)
      .maybeSingle();
    if (charterErr || !charter) throw new Error(charterErr?.message || "Charter not found");

    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, full_name, email")
      .eq("id", charter.contact_id)
      .maybeSingle();

    const accessToken = await getValidToken(supabaseAdmin, user.id);

    const fullName = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || contact?.full_name || "Sovereign";
    const docTitle = `Sovereignty Charter — ${fullName} (Ratification)`;

    // 1. Create the Google Doc
    const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: docTitle }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      const apiMsg = created.error?.message || JSON.stringify(created);
      if (createRes.status === 401 || createRes.status === 403 || /insufficient/i.test(apiMsg)) {
        throw new InsufficientScopeError(
          "Your Google connection is missing required permissions for Docs and Drive. Please go to Settings → Google, disconnect, and reconnect to grant the new permissions.",
        );
      }
      throw new Error(`Failed to create doc: ${apiMsg}`);
    }
    const docId: string = created.documentId;
    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

    // 2. Insert content via batchUpdate
    const markdown = buildCharterMarkdown(charter, contact);
    const requests = buildBatchUpdateRequests(markdown);
    if (requests.length > 0) {
      const updRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      });
      const updJson = await updRes.json();
      if (!updRes.ok) {
        console.error("batchUpdate failed:", updJson);
        throw new Error(`Failed to populate doc: ${updJson.error?.message || JSON.stringify(updJson)}`);
      }
    }

    // 3. Update charter row
    const sentAt = new Date().toISOString();
    await supabaseAdmin
      .from("sovereignty_charters")
      .update({
        esign_status: "sent",
        esign_doc_id: docId,
        esign_doc_url: docUrl,
        esign_sent_at: sentAt,
        esign_initiated_by: user.id,
        esign_error: null,
      })
      .eq("id", charter_id);

    return new Response(
      JSON.stringify({
        ok: true,
        document_id: docId,
        document_url: docUrl,
        instructions:
          "Open the Google Doc, then use Tools → eSignature to add signature fields (Sovereign first, Personal CFO second) and send for signing. The system will auto-detect signature completion and ratify the charter.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("charter-esign-create error:", e);
    const isScopeErr = e instanceof InsufficientScopeError;
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
        code: isScopeErr ? "reconnect_google" : "unknown",
      }),
      { status: isScopeErr ? 412 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

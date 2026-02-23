import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Auth check with user token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // Service client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { contactId, filePath, contactName } = await req.json();
    if (!contactId || !filePath) throw new Error("Missing contactId or filePath");

    // Download the file from storage
    const { data: fileData, error: dlErr } = await adminClient.storage
      .from("statement-uploads")
      .download(filePath);
    if (dlErr || !fileData) throw new Error("Failed to download file: " + dlErr?.message);

    // Convert to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = "application/pdf";

    // Call Lovable AI Gateway to extract financial data
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a financial statement parser. Extract investment/brokerage account data from the uploaded document.
Return a JSON object with this exact structure:
{
  "accounts": [
    {
      "account_name": "Institution - Account Type",
      "account_number": "string or null",
      "account_type": "Portfolio|RRSP|TFSA|RESP|LIRA|LIF|Corporate|Trust|Other",
      "current_value": number or null,
      "notes": "Any classification notes (e.g. Eligible Harvest, Protected Growth)"
    }
  ],
  "summary": "Brief one-line summary of total holdings",
  "ebitda": number or null,
  "operating_income": number or null
}
Only include data you can confidently extract. Use null for uncertain values. Return ONLY the JSON, no markdown.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Parse this financial statement for ${contactName || "the client"}. Extract all investment accounts with their values, account numbers, and types.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error("AI parsing failed: " + errText);
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    // Clean any markdown fences
    const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed: {
      accounts: Array<{
        account_name: string;
        account_number: string | null;
        account_type: string;
        current_value: number | null;
        notes: string | null;
      }>;
      summary: string | null;
      ebitda: number | null;
      operating_income: number | null;
    };

    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse AI response as JSON: " + jsonStr.slice(0, 200));
    }

    // Create review queue items for each extracted account
    const reviewItems = [];

    for (const account of parsed.accounts || []) {
      const { data: rqItem, error: rqErr } = await adminClient
        .from("review_queue")
        .insert({
          action_type: "statement_ingestion",
          action_description: `Create vineyard account: ${account.account_name}${account.current_value ? ` ($${account.current_value.toLocaleString()})` : ""}`,
          contact_id: contactId,
          created_by: user.id,
          proposed_data: {
            table: "vineyard_accounts",
            action: "insert",
            data: {
              contact_id: contactId,
              account_name: account.account_name,
              account_number: account.account_number,
              account_type: account.account_type || "Portfolio",
              current_value: account.current_value,
              notes: account.notes,
            },
          },
          logic_trace: `Extracted from uploaded statement via AI parsing. File: ${filePath}`,
          status: "pending",
        })
        .select("id")
        .single();

      if (!rqErr && rqItem) reviewItems.push(rqItem);
    }

    // If summary data was extracted, create a review item for contact updates
    if (parsed.summary || parsed.ebitda || parsed.operating_income) {
      const contactUpdate: Record<string, unknown> = {};
      if (parsed.summary) contactUpdate.vineyard_balance_sheet_summary = parsed.summary;
      if (parsed.ebitda) contactUpdate.vineyard_ebitda = parsed.ebitda;
      if (parsed.operating_income) contactUpdate.vineyard_operating_income = parsed.operating_income;

      await adminClient.from("review_queue").insert({
        action_type: "statement_ingestion",
        action_description: `Update contact vineyard data from statement${parsed.summary ? `: ${parsed.summary}` : ""}`,
        contact_id: contactId,
        created_by: user.id,
        proposed_data: {
          table: "contacts",
          action: "update",
          data: contactUpdate,
        },
        logic_trace: `Financial summary extracted from uploaded statement via AI parsing. File: ${filePath}`,
        status: "pending",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        accountsExtracted: parsed.accounts?.length || 0,
        reviewItemsCreated: reviewItems.length + (parsed.summary || parsed.ebitda || parsed.operating_income ? 1 : 0),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ingest-statement error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

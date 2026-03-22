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

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { contactId, householdId, filePath, contactName } = await req.json();
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
            content: `You are a financial statement parser for a Canadian family office. Extract investment/brokerage account data from the uploaded document.
Return a JSON object with this exact structure:
{
  "accounts": [
    {
      "account_name": "Institution - Account Type (e.g. iA Financial - RRSP)",
      "account_number": "string or null",
      "account_type": "Portfolio|RRSP|TFSA|RESP|LIRA|LIF|Corporate|Trust|Other",
      "account_owner": "Full name of the account holder or null",
      "custodian": "Name of the financial institution (e.g. iA Financial, JustWealth, RBC)",
      "book_value": number or null,
      "current_value": number or null,
      "notes": "Any classification notes (e.g. Eligible Harvest, Protected Growth)"
    }
  ],
  "summary": "Brief one-line summary of total holdings",
  "missing_fields": ["list of fields that could not be confidently extracted"]
}

Guidelines:
- "book_value" is the beginning-of-year value, cost basis, or original investment amount
- "current_value" is the most recent market value shown
- If the document shows multiple dates, use the earliest as book_value and latest as current_value
- Extract the account owner name from the statement header/title
- Identify the custodian/institution from the statement branding
- Use null for any values you cannot confidently extract
- Return ONLY the JSON, no markdown`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Parse this financial statement for ${contactName || "the client"}. Extract all investment accounts with their values, account numbers, types, owners, and custodian information.`,
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
        account_owner: string | null;
        custodian: string | null;
        book_value: number | null;
        current_value: number | null;
        notes: string | null;
      }>;
      summary: string | null;
      missing_fields: string[];
    };

    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse AI response as JSON: " + jsonStr.slice(0, 200));
    }

    // Insert extracted accounts into the Holding Tank
    const insertedAccounts = [];

    for (const account of parsed.accounts || []) {
      const { data: htItem, error: htErr } = await adminClient
        .from("holding_tank")
        .insert({
          contact_id: contactId,
          household_id: householdId || null,
          account_name: account.account_name,
          account_number: account.account_number,
          account_type: account.account_type || "Portfolio",
          account_owner: account.account_owner,
          custodian: account.custodian,
          book_value: account.book_value,
          current_value: account.current_value,
          notes: account.notes,
          source_file: filePath,
          status: "holding",
        })
        .select("id")
        .single();

      if (!htErr && htItem) insertedAccounts.push(htItem);
    }

    // Create a review queue item summarizing the ingestion
    await adminClient.from("review_queue").insert({
      action_type: "statement_ingestion",
      action_description: `Parsed ${insertedAccounts.length} account(s) from statement into Holding Tank${parsed.summary ? `: ${parsed.summary}` : ""}`,
      contact_id: contactId,
      created_by: user.id,
      proposed_data: {
        holding_tank_ids: insertedAccounts.map(a => a.id),
        summary: parsed.summary,
        missing_fields: parsed.missing_fields || [],
      },
      logic_trace: `AI extracted ${parsed.accounts?.length || 0} accounts from uploaded statement. File: ${filePath}. Missing fields: ${(parsed.missing_fields || []).join(", ") || "none"}`,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        success: true,
        accountsExtracted: parsed.accounts?.length || 0,
        accountsInserted: insertedAccounts.length,
        missingFields: parsed.missing_fields || [],
        summary: parsed.summary,
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

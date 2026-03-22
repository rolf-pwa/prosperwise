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

    const { filePaths, familyName } = await req.json();
    if (!filePaths || !filePaths.length) throw new Error("No files provided");

    // Download and convert all files to base64
    const fileContents: Array<{ path: string; base64: string }> = [];
    for (const fp of filePaths) {
      const { data: fileData, error: dlErr } = await adminClient.storage
        .from("statement-uploads")
        .download(fp);
      if (dlErr || !fileData) throw new Error("Failed to download: " + fp);
      const ab = await fileData.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      fileContents.push({ path: fp, base64: b64 });
    }

    // Build multi-file message content
    const userContent: any[] = [
      {
        type: "text",
        text: `Parse these ${fileContents.length} financial statement(s) for a new client onboarding. Extract ALL individuals mentioned, their contact information, and every investment account.

Return a JSON object with this exact structure:
{
  "family_name": "Suggested family name based on the primary account holder's surname",
  "individuals": [
    {
      "full_name": "Full legal name as shown on statement",
      "first_name": "First name",
      "last_name": "Last name or null",
      "email": "Email if found or null",
      "phone": "Phone if found or null",
      "address": "Full mailing address if found or null",
      "is_primary": true/false (true for the main account holder),
      "relationship_hint": "e.g. spouse, child, joint holder, or null"
    }
  ],
  "accounts": [
    {
      "account_name": "Institution - Account Type",
      "account_number": "string or null",
      "account_type": "Portfolio|RRSP|TFSA|RESP|LIRA|LIF|Corporate|Trust|Other",
      "account_owner_name": "Full name of owner as it appears on statement",
      "custodian": "Financial institution name",
      "book_value": number or null,
      "current_value": number or null,
      "notes": "Classification notes",
      "source_file_index": 0
    }
  ],
  "summary": "Brief summary of total holdings and household composition"
}

Guidelines:
- Extract EVERY individual mentioned across all statements
- Match account owners to individuals by name
- "book_value" = beginning of year / cost basis / original investment
- "current_value" = most recent market value
- "source_file_index" = zero-based index of which uploaded file this came from
- Use null for values you cannot confidently extract
- Return ONLY valid JSON, no markdown fences`,
      },
    ];

    for (let i = 0; i < fileContents.length; i++) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${fileContents[i].base64}` },
      });
    }

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
            content: `You are a financial statement parser for a Canadian family office. Extract all individuals and investment accounts from uploaded documents. Be thorough — capture every person and every account.`,
          },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI parsing failed: " + errText);
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";
    const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse AI response: " + jsonStr.slice(0, 300));
    }

    // Use provided family name or AI-suggested
    const finalFamilyName = familyName || parsed.family_name || "New Family";

    // Step 1: Create Family
    const { data: family, error: famErr } = await adminClient
      .from("families")
      .insert({ name: finalFamilyName, created_by: user.id })
      .select("id")
      .single();
    if (famErr) throw new Error("Failed to create family: " + famErr.message);

    // Step 2: Create Household
    const { data: household, error: hhErr } = await adminClient
      .from("households")
      .insert({ family_id: family.id, label: "Primary" })
      .select("id")
      .single();
    if (hhErr) throw new Error("Failed to create household: " + hhErr.message);

    // Step 3: Create Contacts for each individual
    const contactMap: Record<string, string> = {}; // name -> contact_id
    const createdContacts: any[] = [];

    for (const individual of parsed.individuals || []) {
      const { data: contact, error: cErr } = await adminClient
        .from("contacts")
        .insert({
          full_name: individual.full_name || `${individual.first_name} ${individual.last_name || ""}`.trim(),
          first_name: individual.first_name || individual.full_name?.split(" ")[0] || "",
          last_name: individual.last_name || individual.full_name?.split(" ").slice(1).join(" ") || null,
          email: individual.email || null,
          phone: individual.phone || null,
          address: individual.address || null,
          family_id: family.id,
          household_id: household.id,
          family_role: individual.is_primary ? "head_of_family" : "beneficiary",
          created_by: user.id,
        })
        .select("id, full_name")
        .single();

      if (!cErr && contact) {
        contactMap[individual.full_name?.toLowerCase() || ""] = contact.id;
        contactMap[(individual.account_owner_name || individual.full_name || "").toLowerCase()] = contact.id;
        createdContacts.push(contact);
      }
    }

    // If no contacts were created, create a placeholder
    if (createdContacts.length === 0) {
      const { data: placeholder, error: phErr } = await adminClient
        .from("contacts")
        .insert({
          full_name: finalFamilyName,
          first_name: finalFamilyName.split(" ")[0],
          last_name: finalFamilyName.split(" ").slice(1).join(" ") || null,
          family_id: family.id,
          household_id: household.id,
          family_role: "head_of_family",
          created_by: user.id,
        })
        .select("id, full_name")
        .single();
      if (!phErr && placeholder) {
        createdContacts.push(placeholder);
        contactMap["default"] = placeholder.id;
      }
    }

    // Step 4: Create Holding Tank entries for each account
    const insertedAccounts: any[] = [];
    const primaryContactId = createdContacts[0]?.id;

    for (const account of parsed.accounts || []) {
      // Match owner to a contact
      const ownerKey = (account.account_owner_name || "").toLowerCase();
      let contactId = contactMap[ownerKey];
      
      // Try partial match if exact match fails
      if (!contactId) {
        for (const [key, id] of Object.entries(contactMap)) {
          if (key !== "default" && (ownerKey.includes(key) || key.includes(ownerKey))) {
            contactId = id;
            break;
          }
        }
      }
      
      contactId = contactId || contactMap["default"] || primaryContactId;

      const { data: htItem, error: htErr } = await adminClient
        .from("holding_tank")
        .insert({
          contact_id: contactId,
          household_id: household.id,
          account_name: account.account_name,
          account_number: account.account_number,
          account_type: account.account_type || "Portfolio",
          account_owner: account.account_owner_name,
          custodian: account.custodian,
          book_value: account.book_value,
          current_value: account.current_value,
          notes: account.notes,
          source_file: filePaths[account.source_file_index ?? 0] || filePaths[0],
          status: "holding",
        })
        .select("id")
        .single();

      if (!htErr && htItem) insertedAccounts.push(htItem);
    }

    // Step 5: Create review queue item
    await adminClient.from("review_queue").insert({
      action_type: "onboarding_ingestion",
      action_description: `Onboarded ${finalFamilyName}: ${createdContacts.length} contact(s), ${insertedAccounts.length} account(s) staged in Holding Tank`,
      family_id: family.id,
      created_by: user.id,
      proposed_data: {
        family_id: family.id,
        household_id: household.id,
        contact_ids: createdContacts.map((c) => c.id),
        holding_tank_ids: insertedAccounts.map((a) => a.id),
        summary: parsed.summary,
      },
      logic_trace: `AI parsed ${filePaths.length} statement(s). Extracted ${parsed.individuals?.length || 0} individuals and ${parsed.accounts?.length || 0} accounts. Family: ${finalFamilyName}.`,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        success: true,
        family: { id: family.id, name: finalFamilyName },
        household: { id: household.id },
        contacts: createdContacts,
        accountsExtracted: parsed.accounts?.length || 0,
        accountsInserted: insertedAccounts.length,
        summary: parsed.summary,
        parsedData: parsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("onboarding-ingest error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

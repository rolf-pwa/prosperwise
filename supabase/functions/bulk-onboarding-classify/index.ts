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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { chunkPath, chunkIndex, startPage, pageCount } = await req.json();
    if (!chunkPath) throw new Error("Missing chunkPath");

    // Download chunk from storage
    const { data: fileData, error: dlErr } = await adminClient.storage
      .from("statement-uploads")
      .download(chunkPath);
    if (dlErr || !fileData) throw new Error("Failed to download chunk: " + dlErr?.message);

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

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
            content: `You are a document boundary detector for a Canadian family office. You are analyzing a chunk of a larger omnibus PDF containing multiple clients' financial statements concatenated together.

Your job is to identify WHERE one client's statements end and another's begin within this chunk, and WHO each section belongs to.

Return a JSON object:
{
  "clients": [
    {
      "client_name": "Full name of the primary account holder",
      "pages_in_chunk": [1, 2, 3],
      "institutions": ["List of financial institutions found"],
      "account_count": 3,
      "notes": "Any useful context"
    }
  ]
}

Guidelines:
- Page numbers are 1-based WITHIN this chunk (not the original document)
- Look for headers, account holder names, institution branding to detect boundaries
- A new client section typically starts with a cover page or new institution header with a different name
- If the same client has statements from multiple institutions, group them under one client entry
- Be thorough — every page must be assigned to a client
- Return ONLY valid JSON`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `This is chunk ${chunkIndex + 1}, containing pages ${startPage + 1} to ${startPage + pageCount} of the original document. Identify all client boundaries within these ${pageCount} pages.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${base64}` },
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
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait and retry." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI classification failed: " + errText);
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

    // Map chunk-local page numbers back to original document page numbers
    const clients = (parsed.clients || []).map((c: any) => ({
      ...c,
      original_pages: (c.pages_in_chunk || []).map((p: number) => startPage + p),
    }));

    return new Response(
      JSON.stringify({ success: true, chunkIndex, clients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("bulk-classify error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

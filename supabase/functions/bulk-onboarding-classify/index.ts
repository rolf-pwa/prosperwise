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

    const { chunkPaths } = await req.json();
    if (!chunkPaths?.length) throw new Error("No chunks provided");

    // Process chunks in batches to identify client names
    const results: Array<{ chunkIndex: number; clientName: string; institutions: string[] }> = [];

    for (let i = 0; i < chunkPaths.length; i++) {
      const { data: fileData, error: dlErr } = await adminClient.storage
        .from("statement-uploads")
        .download(chunkPaths[i]);
      if (dlErr || !fileData) {
        console.error(`Failed to download chunk ${i}: ${dlErr?.message}`);
        results.push({ chunkIndex: i, clientName: "Unknown", institutions: [] });
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `Extract the primary account holder's full name (a real person, NOT the dealer firm or advisory company) from this financial statement's first page. Return ONLY a JSON object: {"client_name": "Firstname Lastname", "institutions": ["institution names"]}. No markdown.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Who is the account holder on this statement?" },
                { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          // Rate limited — wait and retry once
          await new Promise((r) => setTimeout(r, 3000));
          results.push({ chunkIndex: i, clientName: "Rate Limited", institutions: [] });
          continue;
        }
        results.push({ chunkIndex: i, clientName: "Unknown", institutions: [] });
        continue;
      }

      const aiResult = await aiResponse.json();
      const rawContent = aiResult.choices?.[0]?.message?.content || "";
      const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        const parsed = JSON.parse(jsonStr);
        results.push({
          chunkIndex: i,
          clientName: parsed.client_name || "Unknown",
          institutions: parsed.institutions || [],
        });
      } catch {
        results.push({ chunkIndex: i, clientName: "Unknown", institutions: [] });
      }

      // Small delay between calls to avoid rate limiting
      if (i < chunkPaths.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return new Response(
      JSON.stringify({ success: true, classifications: results }),
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

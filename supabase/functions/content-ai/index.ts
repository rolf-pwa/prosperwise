import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, title, body, platform, tone, audience } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "generate_draft") {
      systemPrompt = `You are a content strategist for a wealth management firm called ProsperWise Advisors. 
You write clear, authoritative, and approachable content about family wealth governance, financial planning, estate planning, and intergenerational wealth transfer.
Tone: ${tone || "professional yet warm"}
Target audience: ${audience || "high-net-worth families and business owners"}
Write in first person plural ("we") representing the firm.
Do NOT include any metadata, headers like "Title:" or "Body:" — just write the content directly.`;

      userPrompt = `Write a content piece with this title: "${title}"

Write a comprehensive article (600-1000 words) that would be suitable as a blog post. Include:
- An engaging opening hook
- 3-4 key points with supporting details
- A clear call to action at the end
- Natural paragraph breaks

Just write the article content, no meta-commentary.`;
    } else if (action === "repurpose") {
      const platformGuides: Record<string, string> = {
        linkedin: `Repurpose for LinkedIn:
- Keep it under 1300 characters (ideal LinkedIn post length)
- Start with a compelling hook line that stops the scroll
- Use short paragraphs (1-2 sentences each)
- Include relevant emojis sparingly for visual breaks
- End with a question or call to engagement
- Add 3-5 relevant hashtags at the end
- Write in first person ("I" not "we") for LinkedIn personal branding
- Make it conversational and insight-driven`,
        substack: `Repurpose for Substack newsletter:
- Write a newsletter-style piece (800-1500 words)
- Start with a personal anecdote or observation
- Use a conversational, intimate tone like writing to a friend
- Include section headers for scannability
- Add a "TL;DR" or key takeaway section
- End with a thoughtful question for readers
- Include a "What I'm reading/thinking about" sidebar if relevant
- Write in first person`,
        wix_blog: `Repurpose for a Wix blog post:
- Write 500-800 words, optimized for SEO
- Include a compelling meta description (under 160 characters) at the very start, prefixed with "META: "
- Use H2 and H3 headers for structure (use ## and ### markdown)
- Include bullet points and numbered lists where appropriate
- Write in a professional but accessible tone
- End with a clear call to action
- Use the firm's voice ("we" / "our team")`,
      };

      systemPrompt = `You are a content repurposing expert for ProsperWise Advisors, a wealth management firm.
Your job is to take an existing piece of content and adapt it for a specific platform while maintaining the core message and insights.
${platformGuides[platform] || "Adapt the content appropriately for the target platform."}

Output ONLY the repurposed content. No meta-commentary, no "Here's the repurposed version:" prefix.`;

      userPrompt = `Original title: ${title}

Original content:
${body}

Repurpose this for ${platform === "wix_blog" ? "a Wix blog post" : platform === "linkedin" ? "LinkedIn" : "Substack"}.`;
    } else if (action === "improve") {
      systemPrompt = `You are an expert editor for ProsperWise Advisors. Improve the given content by:
- Tightening the prose and removing filler
- Strengthening the opening hook
- Improving transitions between ideas
- Making the call to action more compelling
- Fixing any grammar or style issues
Output ONLY the improved content. No commentary.`;

      userPrompt = `Title: ${title}\n\nContent to improve:\n${body}`;
    } else if (action === "suggest_titles") {
      systemPrompt = `You are a content strategist for ProsperWise Advisors.
Generate 5 compelling content titles based on the given topic.
Format: Return ONLY a JSON array of 5 title strings, nothing else.
Example: ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]`;

      userPrompt = `Generate 5 content titles about: ${title || body}`;
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("content-ai error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

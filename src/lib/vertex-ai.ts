import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

type Message = { role: "user" | "assistant" | "system"; content: string };

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

/** Non-streaming call to Vertex AI Gemini Pro */
export async function askGemini(messages: Message[], model?: string): Promise<string> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/vertex-ai`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, model, stream: false }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Vertex AI request failed");
  return data.text;
}

/** Streaming call to Vertex AI Gemini Pro */
export async function streamGemini({
  messages,
  model,
  onDelta,
  onDone,
}: {
  messages: Message[];
  model?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/vertex-ai`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, model, stream: true }),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: "Stream failed" }));
    throw new Error(err.error || "Stream failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ") || line.trim() === "") continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        onDone();
        return;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onDelta(text);
      } catch {
        // partial JSON, re-buffer
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  onDone();
}

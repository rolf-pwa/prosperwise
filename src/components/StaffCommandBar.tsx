import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Terminal, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

interface CommandMessage {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLE_COMMANDS = [
  "Show all leads from this week",
  "Which families are in the Legacy Tier?",
  "Create an Asana project for the Johnson Family",
  "Who has a Quiet Period ending soon?",
];

export function StaffCommandBar() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CommandMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendCommand = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: CommandMessage = { role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("vertex-ai", {
        body: {
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt: `You are the ProsperWise Sovereign Command Assistant. You help advisors manage their CRM using plain language. 

You have access to the following capabilities (explain what action you'd take in plain terms — you cannot execute directly):
- Querying and filtering contacts, families, households, and discovery leads
- Summarizing governance statuses and fee tiers
- Identifying Quiet Period deadlines
- Suggesting Asana project creation steps
- Providing clear, concise responses under 150 words

Always respond in a confident, concise advisory tone. If the advisor's request requires a CRM action you cannot execute directly, describe exactly what they need to do and where.`,
        },
      });

      if (error) throw error;
      const reply = data?.text ?? data?.content ?? data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "I couldn't process that request.";
      setMessages([...updated, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...updated,
        { role: "assistant", content: "Command failed. Please try again or check your connection." },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCommand(input);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-foreground">Command Bar</span>
          <Badge variant="outline" className="text-[10px] ml-auto">AI</Badge>
        </div>

        {/* Message history */}
        {messages.length > 0 && (
          <div className="space-y-2 max-h-52 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={`inline-block rounded-lg px-3 py-1.5 text-sm max-w-[90%] ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none text-foreground text-sm">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-left">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Example prompts (only shown when no history) */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                onClick={() => sendCommand(cmd)}
                className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {cmd}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command… (Enter to send)"
            rows={1}
            className="resize-none text-sm min-h-[38px] max-h-24"
          />
          <Button
            size="icon"
            onClick={() => sendCommand(input)}
            disabled={!input.trim() || loading}
            className="shrink-0 h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Loader2, ShieldCheck, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

type Message = { role: "user" | "assistant"; content: string };

interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

type Phase = "chat" | "lead_capture" | "complete";

export default function DiscoveryEmbed() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("chat");
  const [discoveryData, setDiscoveryData] = useState<Record<string, any>>({});
  const [leadForm, setLeadForm] = useState({ first_name: "", phone: "", email: "" });
  const [pipedaConsent, setPipedaConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!hasGreeted) {
      setHasGreeted(true);
      sendToGeorgia([{ role: "user", content: "Hello" }], true);
    }
  }, []);

  async function sendToGeorgia(msgs: Message[], isGreeting = false) {
    setIsLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/discovery-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: msgs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");

      const assistantMsg: Message = { role: "assistant", content: data.text };
      if (isGreeting) {
        setMessages([assistantMsg]);
      } else {
        setMessages((prev) => [...prev, assistantMsg]);
      }

      if (data.functionCalls?.length > 0) {
        const leadCall = data.functionCalls.find(
          (fc: FunctionCall) => fc.name === "register_discovery_lead"
        );
        if (leadCall) {
          setDiscoveryData(leadCall.args);
          setPhase("lead_capture");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection error");
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    await sendToGeorgia(newMessages);
  }

  async function submitLead() {
    if (!leadForm.first_name || !leadForm.email) {
      toast.error("Please provide your name and email.");
      return;
    }
    if (!pipedaConsent) {
      toast.error("Please accept the privacy consent to proceed.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/discovery-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "register_lead",
          leadData: {
            ...leadForm,
            ...discoveryData,
            pipeda_consent: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      setPhase("complete");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Thank you! Your information has been received. Rolf Issler will be in touch shortly to schedule your Stabilization Triage. In the meantime, take a breath — you've taken an important first step toward sovereignty.",
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      {/* Compact Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/30">
            <span className="text-sm font-serif text-accent">G</span>
          </div>
          <div>
            <h1 className="font-serif text-sm font-semibold text-foreground leading-tight">Georgia</h1>
            <p className="text-[10px] text-muted-foreground">Discovery Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5">
          <Lock className="h-2.5 w-2.5 text-primary" />
          <span className="text-[10px] text-primary">Secure</span>
        </div>
      </header>

      {/* Chat Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                    <span className="text-xs font-serif text-accent">G</span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground ring-1 ring-border"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-p:leading-relaxed">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                <span className="text-xs font-serif text-accent">G</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3.5 py-2.5 ring-1 ring-border">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:300ms]" />
              </div>
            </motion.div>
          )}

          {/* Lead Capture Form */}
          {phase === "lead_capture" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-accent/20">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                    <h3 className="font-serif text-sm font-semibold text-foreground">
                      Connect with Rolf
                    </h3>
                  </div>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Provide your details to schedule your Stabilization Triage session.
                  </p>

                  <div className="space-y-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        First Name <span className="text-accent">*</span>
                      </label>
                      <Input
                        value={leadForm.first_name}
                        onChange={(e) => setLeadForm((f) => ({ ...f, first_name: e.target.value }))}
                        placeholder="Your first name"
                        maxLength={100}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">Phone</label>
                      <Input
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="(555) 555-5555"
                        maxLength={20}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        Email <span className="text-accent">*</span>
                      </label>
                      <Input
                        type="email"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                        maxLength={255}
                        className="h-9 text-sm"
                      />
                    </div>

                    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 p-2.5">
                      <Checkbox
                        id="pipeda-embed"
                        checked={pipedaConsent}
                        onCheckedChange={(v) => setPipedaConsent(v === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor="pipeda-embed" className="text-[11px] leading-relaxed text-muted-foreground cursor-pointer">
                        I consent to ProsperWise collecting and processing my personal information under
                        <span className="text-accent font-medium"> PIPEDA</span>. Data processed in Canadian data centres only.
                      </label>
                    </div>

                    <Button
                      onClick={submitLead}
                      disabled={isSubmitting || !leadForm.first_name || !leadForm.email || !pipedaConsent}
                      className="w-full h-9 text-sm"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Request Stabilization Triage"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {phase === "complete" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border-primary/20 bg-primary/5 text-center">
                <CardContent className="p-5">
                  <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-primary" />
                  <p className="font-serif text-sm text-foreground">
                    Your Stabilization Triage has been requested.
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Rolf Issler will reach out within 1–2 business days.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      {phase === "chat" && (
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share what's on your mind..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="h-9 w-9 shrink-0 rounded-xl"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[9px] text-muted-foreground">
            Protected by PIPEDA · Data processed in Canada · Fee-Only advisory
          </p>
        </div>
      )}
    </div>
  );
}

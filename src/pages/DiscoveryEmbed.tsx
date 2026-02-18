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

const STORAGE_KEY = "georgia_embed_state_v2";

function loadSavedState(): { messages: Message[]; phase: Phase } | null {
  try {
    // Clear old cache key
    localStorage.removeItem("georgia_embed_state");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(messages: Message[], phase: Phase) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, phase }));
  } catch {
    // ignore
  }
}

export default function DiscoveryEmbed() {
  const saved = loadSavedState();
  const [messages, setMessages] = useState<Message[]>(saved?.messages || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>(saved?.phase || "chat");
  const [discoveryData, setDiscoveryData] = useState<Record<string, any>>({});
  const [leadForm, setLeadForm] = useState({ first_name: "", phone: "", email: "" });
  const [pipedaConsent, setPipedaConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist state to localStorage
  useEffect(() => {
    saveState(messages, phase);
  }, [messages, phase]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Greet only if no saved messages
  useEffect(() => {
    if (messages.length === 0) {
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
        const leadCall = data.functionCalls.find((fc: FunctionCall) => fc.name === "register_discovery_lead");
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
            "Thank you! Your information has been received. Rolf Issler will be in touch shortly to schedule your Transition Session. In the meantime, take a breath — you've taken an important first step toward sovereignty.",
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
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "100vh", backgroundColor: "#05070a", color: "#e2e8f0" }}
    >
      {/* Minimal Header — compressed for 400px iframe */}
      <header
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(42,64,52,0.4)", outline: "1px solid rgba(42,64,52,0.6)" }}
          >
            <span className="text-[11px] font-serif" style={{ color: "#4ade80" }}>G</span>
          </div>
          <div className="leading-none">
            <span className="text-xs font-semibold" style={{ color: "#f1f5f9" }}>Georgia</span>
            <span className="ml-1.5 text-[9px]" style={{ color: "#94a3b8" }}>· Transition Assistant</span>
          </div>
        </div>
        <div
          className="flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{ border: "1px solid rgba(42,64,52,0.5)", backgroundColor: "rgba(42,64,52,0.15)" }}
        >
          <Lock className="h-2 w-2" style={{ color: "#4ade80" }} />
          <span className="text-[9px]" style={{ color: "#4ade80" }}>Secure</span>
        </div>
      </header>

      {/* Chat Area — fills remaining space */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-3">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(42,64,52,0.4)", outline: "1px solid rgba(42,64,52,0.5)" }}
                  >
                    <span className="text-[10px] font-serif" style={{ color: "#4ade80" }}>G</span>
                  </div>
                )}
                <div
                  className="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
                  style={
                    msg.role === "user"
                      ? { backgroundColor: "#2A4034", color: "#e2e8f0" }
                      : { backgroundColor: "rgba(255,255,255,0.05)", color: "#cbd5e1", outline: "1px solid rgba(255,255,255,0.08)" }
                  }
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-invert prose-p:my-0.5 prose-p:leading-relaxed">
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
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(42,64,52,0.4)", outline: "1px solid rgba(42,64,52,0.5)" }}
              >
                <span className="text-[10px] font-serif" style={{ color: "#4ade80" }}>G</span>
              </div>
              <div
                className="flex items-center gap-1.5 rounded-2xl px-3 py-2"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", outline: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" style={{ backgroundColor: "#4ade80", opacity: 0.6 }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" style={{ backgroundColor: "#4ade80", opacity: 0.6 }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" style={{ backgroundColor: "#4ade80", opacity: 0.6 }} />
              </div>
            </motion.div>
          )}

          {/* Lead Capture Form */}
          {phase === "lead_capture" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <div
                className="rounded-xl p-3 space-y-2.5"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(42,64,52,0.4)" }}
              >
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#4ade80" }} />
                  <span className="text-[11px] font-semibold" style={{ color: "#f1f5f9" }}>Connect with Rolf</span>
                </div>
                <p className="text-[10px]" style={{ color: "#94a3b8" }}>
                  Provide your details to schedule your Transition Session.
                </p>

                <Input
                  value={leadForm.first_name}
                  onChange={(e) => setLeadForm((f) => ({ ...f, first_name: e.target.value }))}
                  placeholder="First name *"
                  maxLength={100}
                  className="h-8 text-xs"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                />
                <Input
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone"
                  maxLength={20}
                  className="h-8 text-xs"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                />
                <Input
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Email *"
                  maxLength={255}
                  className="h-8 text-xs"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                />

                <div
                  className="flex items-start gap-2 rounded-lg p-2"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <Checkbox
                    id="pipeda-embed"
                    checked={pipedaConsent}
                    onCheckedChange={(v) => setPipedaConsent(v === true)}
                    className="mt-0.5 shrink-0"
                  />
                  <label
                    htmlFor="pipeda-embed"
                    className="text-[9px] leading-relaxed cursor-pointer"
                    style={{ color: "#94a3b8" }}
                  >
                    I consent to ProsperWise collecting my information under{" "}
                    <span style={{ color: "#4ade80" }}>PIPEDA</span>. Processed in Canadian data centres only.
                  </label>
                </div>

                <Button
                  onClick={submitLead}
                  disabled={isSubmitting || !leadForm.first_name || !leadForm.email || !pipedaConsent}
                  className="w-full h-8 text-xs font-semibold"
                  style={{ backgroundColor: "#2A4034", color: "#e2e8f0" }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Request Transition Session"
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "complete" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div
                className="rounded-xl p-4 text-center"
                style={{ backgroundColor: "rgba(42,64,52,0.2)", border: "1px solid rgba(42,64,52,0.4)" }}
              >
                <ShieldCheck className="mx-auto mb-2 h-6 w-6" style={{ color: "#4ade80" }} />
                <p className="text-xs font-semibold" style={{ color: "#f1f5f9" }}>Transition Session Requested</p>
                <p className="mt-1 text-[10px]" style={{ color: "#94a3b8" }}>
                  Rolf Issler will reach out within 1–2 business days.
                </p>
              </div>
            </motion.div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input — pinned to bottom */}
      {phase === "chat" && (
        <div
          className="shrink-0 px-3 py-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share what's on your mind..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl px-3 py-2 text-xs placeholder:text-slate-500 focus-visible:outline-none"
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl disabled:opacity-40"
              style={{ backgroundColor: "#2A4034" }}
            >
              <Send className="h-3.5 w-3.5" style={{ color: "#e2e8f0" }} />
            </button>
          </div>
          <p className="mt-1 text-center text-[8px]" style={{ color: "#475569" }}>
            PIPEDA · Canada · Fee-Only
          </p>
        </div>
      )}
    </div>
  );
}

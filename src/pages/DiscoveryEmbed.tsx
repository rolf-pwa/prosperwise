import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

function loadSavedState(): { messages: Message[]; phase: Phase; discoveryData?: Record<string, any> } | null {
  try {
    sessionStorage.removeItem("georgia_embed_state");
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(messages: Message[], phase: Phase, discoveryData: Record<string, any>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, phase, discoveryData }));
  } catch {
    // ignore
  }
}

// Sanctuary palette — warm vellum light, "old money" feel
const C = {
  bg: "#F8F6F2",          // vellum — the primary background
  surface: "#EFECE6",     // slightly deeper parchment for panels
  surfaceAlt: "#EAE6DF",  // input / alt surface
  border: "rgba(169,140,90,0.35)",   // bronze border
  borderSubtle: "rgba(169,140,90,0.18)",
  vellum: "#F8F6F2",      // light bg (reused for button text)
  charcoal: "#3B3F3F",    // constitutional charcoal — primary text
  muted: "#8A8A80",       // muted stone text
  green: "#2A4034",       // sovereign green — avatar, user bubbles, CTAs
  bronze: "#A98C5A",      // ratified bronze — accents
  bronzeLight: "#C4A46A", // lighter bronze for hover hints
};

export default function DiscoveryEmbed() {
  const saved = loadSavedState();
  const welcomeMessage: Message = {
    role: "assistant",
    content: "Welcome to ProsperWise. My name is Georgia, and I am your Transition Assistant. Most people come here during a time of significant transition — a business sale, a separation, or a legacy event. How can I help you navigate your transition?"
  };
  const [messages, setMessages] = useState<Message[]>(saved?.messages?.length ? saved.messages : [welcomeMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>(saved?.phase || "chat");
  const [discoveryData, setDiscoveryData] = useState<Record<string, any>>(saved?.discoveryData || {});
  const [leadForm, setLeadForm] = useState({ first_name: "", phone: "", email: "" });
  const [pipedaConsent, setPipedaConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    saveState(messages, phase, discoveryData);
  }, [messages, phase, discoveryData]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Welcome to ProsperWise. My name is Georgia, and I am your Transition Assistant. Most people come here during a time of significant transition — a business sale, a separation, or a legacy event. How can I help you navigate your transition?"
      }]);
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
          leadData: { ...leadForm, ...discoveryData, pipeda_consent: true },
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
            "Thank you. Your information has been received. Rolf Issler will be in touch shortly to schedule your Transition Session. You have taken an important first step toward sovereignty.",
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
      style={{ height: "100vh", backgroundColor: C.bg, color: C.vellum }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-8 py-5 shrink-0"
        style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.bg }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: C.green, boxShadow: `0 0 0 1px rgba(42,64,52,0.3)` }}
          >
            <span className="font-serif text-lg" style={{ color: C.vellum }}>G</span>
          </div>
          <div>
            <h1 className="font-serif text-xl font-semibold" style={{ color: C.green, letterSpacing: "-0.01em" }}>
              Georgia
            </h1>
            <p className="text-[11px] tracking-wide uppercase" style={{ color: C.bronze, letterSpacing: "0.08em" }}>
              Transition Assistant · ProsperWise
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 rounded-full px-4 py-1.5"
          style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(42,64,52,0.05)" }}
        >
          <Lock className="h-3 w-3" style={{ color: C.green }} />
          <span className="text-[11px] font-medium" style={{ color: C.green }}>Secure</span>
        </div>
      </header>

      {/* Chat Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-3">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: C.green, boxShadow: `0 0 0 1px ${C.border}` }}
                  >
                    <span className="font-serif text-[10px]" style={{ color: C.vellum }}>G</span>
                  </div>
                )}
                <div
                  className="max-w-[85%] text-xs leading-relaxed"
                  style={
                    msg.role === "user"
                      ? {
                          backgroundColor: C.green,
                          color: C.vellum,
                          borderRadius: "14px 4px 14px 14px",
                          padding: "8px 12px",
                          border: `1px solid rgba(169,140,90,0.25)`,
                        }
                       : {
                           backgroundColor: C.surface,
                           color: C.charcoal,
                           borderRadius: "4px 14px 14px 14px",
                           padding: "8px 12px",
                           border: `1px solid ${C.borderSubtle}`,
                           boxShadow: "0 1px 3px rgba(169,140,90,0.08)",
                         }
                  }
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed"
                      style={{ color: C.charcoal }}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing dots */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: C.green }}
              >
                <span className="font-serif text-[10px]" style={{ color: C.vellum }}>G</span>
              </div>
              <div
                className="flex items-center gap-1.5 rounded-xl px-3 py-2"
                style={{ backgroundColor: C.surface, border: `1px solid ${C.borderSubtle}` }}
              >
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" style={{ backgroundColor: C.bronze }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" style={{ backgroundColor: C.bronze }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" style={{ backgroundColor: C.bronze }} />
              </div>
            </motion.div>
          )}

          {/* Lead Capture Form */}
          {phase === "lead_capture" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <div
                className="rounded-xl p-3 space-y-2.5"
                style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: C.bronze }} />
                  <span className="text-[11px] font-semibold font-serif" style={{ color: C.green }}>Connect with Rolf</span>
                </div>
                <p className="text-[10px]" style={{ color: C.muted }}>
                  Provide your details to schedule your Transition Session.
                </p>

                {[
                  { key: "first_name", placeholder: "First name *", type: "text", max: 100 },
                  { key: "phone", placeholder: "Phone", type: "tel", max: 20 },
                  { key: "email", placeholder: "Email *", type: "email", max: 255 },
                ].map(({ key, placeholder, type, max }) => (
                  <input
                    key={key}
                    type={type}
                    value={leadForm[key as keyof typeof leadForm]}
                    onChange={(e) => setLeadForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    maxLength={max}
                    className="w-full h-8 rounded-lg px-3 text-xs focus-visible:outline-none placeholder:text-[#8A8A80]"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: `1px solid ${C.border}`,
                      color: C.charcoal,
                    }}
                  />
                ))}

                <div
                  className="flex items-start gap-2 rounded-lg p-2"
                  style={{ backgroundColor: "rgba(169,140,90,0.06)", border: `1px solid ${C.border}` }}
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
                    style={{ color: C.muted }}
                  >
                    I consent to ProsperWise collecting my information under{" "}
                    <span style={{ color: C.bronze }}>PIPEDA</span>. Processed in Canadian data centres only.
                  </label>
                </div>

                <button
                  onClick={submitLead}
                  disabled={isSubmitting || !leadForm.first_name || !leadForm.email || !pipedaConsent}
                  className="w-full h-8 rounded-lg text-xs font-semibold tracking-wide disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: C.green, color: C.vellum, border: `1px solid ${C.border}` }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Request Transition Session"
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {phase === "complete" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <div
                className="rounded-xl p-4 text-center"
                style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}
              >
                <div
                  className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(169,140,90,0.12)", border: `1px solid ${C.border}` }}
                >
                  <ShieldCheck className="h-4.5 w-4.5" style={{ color: C.bronze }} />
                </div>
                <p className="text-xs font-semibold font-serif" style={{ color: C.green }}>Transition Session Requested</p>
                <p className="mt-1 text-[10px]" style={{ color: C.muted }}>
                  Rolf Issler will reach out within 1–2 business days.
                </p>
                <p className="mt-2 text-[9px] uppercase tracking-wider" style={{ color: C.bronze }}>
                  Fee-Only · Canada · PIPEDA
                </p>
              </div>
            </motion.div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      {phase === "chat" && (
        <div
          className="shrink-0 px-6 py-4"
          style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.bg }}
        >
          <div className="mx-auto flex max-w-2xl items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share what's on your mind..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl px-4 py-3 text-sm focus-visible:outline-none"
              style={{
                backgroundColor: "#FFFFFF",
                border: `1px solid ${C.border}`,
                color: C.charcoal,
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 1px 4px rgba(59,63,63,0.05)",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: C.green }}
            >
              <Send className="h-4 w-4" style={{ color: C.vellum }} />
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] tracking-wide" style={{ color: C.bronze }}>
            Protected by PIPEDA · Data processed in Canada · Fee-Only advisory
          </p>
        </div>
      )}
    </div>
  );
}

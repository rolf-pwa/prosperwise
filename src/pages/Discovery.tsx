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

const STORAGE_KEY = "georgia_discovery_state_v2";

function loadSavedState(): { messages: Message[]; phase: Phase } | null {
  try {
    sessionStorage.removeItem("georgia_discovery_state");
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(messages: Message[], phase: Phase) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, phase }));
  } catch {
    // ignore
  }
}

export default function Discovery() {
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

  useEffect(() => {
    saveState(messages, phase);
  }, [messages, phase]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
            "Thank you. Your information has been received. Rolf Issler will be in touch within 1–2 business days to schedule your Transition Session. In the meantime, take a breath — you have taken an important first step toward sovereignty.",
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
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#F8F6F2", color: "#3B3F3F" }}
    >
      {/* Header — Sanctuary tone */}
      <header
        className="flex items-center justify-between px-8 py-5 shrink-0"
        style={{ borderBottom: "1px solid #D3C5B7", backgroundColor: "#F8F6F2" }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: "#2A4034", boxShadow: "0 0 0 1px rgba(42,64,52,0.3)" }}
          >
            <span className="font-serif text-lg" style={{ color: "#F8F6F2" }}>G</span>
          </div>
          <div>
            <h1 className="font-serif text-xl font-semibold" style={{ color: "#2A4034", letterSpacing: "-0.01em" }}>
              Georgia
            </h1>
            <p className="text-[11px] tracking-wide uppercase" style={{ color: "#A98C5A", letterSpacing: "0.08em" }}>
              Transition Assistant · ProsperWise
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 rounded-full px-4 py-1.5"
          style={{ border: "1px solid #D3C5B7", backgroundColor: "rgba(42,64,52,0.05)" }}
        >
          <Lock className="h-3 w-3" style={{ color: "#2A4034" }} />
          <span className="text-[11px] font-medium" style={{ color: "#2A4034" }}>Secure · PIPEDA · Canada</span>
        </div>
      </header>

      {/* Chat Area */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-2xl space-y-5 px-6 py-8">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "#2A4034", boxShadow: "0 0 0 1px rgba(42,64,52,0.2)" }}
                  >
                    <span className="font-serif text-sm" style={{ color: "#F8F6F2" }}>G</span>
                  </div>
                )}
                <div
                  className="max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed"
                  style={
                    msg.role === "user"
                      ? {
                          backgroundColor: "#2A4034",
                          color: "#F8F6F2",
                          borderRadius: "18px 4px 18px 18px",
                        }
                      : {
                          backgroundColor: "#FFFFFF",
                          color: "#3B3F3F",
                          border: "1px solid #D3C5B7",
                          borderRadius: "4px 18px 18px 18px",
                          boxShadow: "0 1px 4px rgba(59,63,63,0.06)",
                        }
                  }
                >
                  {msg.role === "assistant" ? (
                    <div
                      className="prose prose-sm max-w-none"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        lineHeight: "1.75",
                        color: "#3B3F3F",
                      }}
                    >
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "#2A4034" }}
              >
                <span className="font-serif text-sm" style={{ color: "#F8F6F2" }}>G</span>
              </div>
              <div
                className="flex items-center gap-1.5 rounded-2xl px-4 py-3"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #D3C5B7" }}
              >
                <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:0ms]" style={{ backgroundColor: "#A98C5A" }} />
                <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]" style={{ backgroundColor: "#A98C5A" }} />
                <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]" style={{ backgroundColor: "#A98C5A" }} />
              </div>
            </motion.div>
          )}

          {/* Lead Capture Form */}
          {phase === "lead_capture" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div
                className="rounded-2xl p-6"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #D3C5B7",
                  boxShadow: "0 2px 12px rgba(59,63,63,0.07)",
                }}
              >
                <div className="mb-1 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" style={{ color: "#2A4034" }} />
                  <h3 className="font-serif text-base font-semibold" style={{ color: "#2A4034" }}>
                    Connect with Rolf
                  </h3>
                </div>
                <p className="mb-5 text-sm" style={{ color: "#6B7070" }}>
                  Provide your details to schedule your Transition Session.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "#3B3F3F" }}>
                      First Name <span style={{ color: "#A98C5A" }}>*</span>
                    </label>
                    <Input
                      value={leadForm.first_name}
                      onChange={(e) => setLeadForm((f) => ({ ...f, first_name: e.target.value }))}
                      placeholder="Your first name"
                      maxLength={100}
                      style={{ borderColor: "#D3C5B7", backgroundColor: "#FDFCFA" }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "#3B3F3F" }}>
                      Phone Number
                    </label>
                    <Input
                      value={leadForm.phone}
                      onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="(555) 555-5555"
                      maxLength={20}
                      style={{ borderColor: "#D3C5B7", backgroundColor: "#FDFCFA" }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "#3B3F3F" }}>
                      Email <span style={{ color: "#A98C5A" }}>*</span>
                    </label>
                    <Input
                      type="email"
                      value={leadForm.email}
                      onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="you@example.com"
                      maxLength={255}
                      style={{ borderColor: "#D3C5B7", backgroundColor: "#FDFCFA" }}
                    />
                  </div>

                  <div
                    className="flex items-start gap-3 rounded-xl p-4"
                    style={{ backgroundColor: "rgba(42,64,52,0.04)", border: "1px solid rgba(42,64,52,0.15)" }}
                  >
                    <Checkbox
                      id="pipeda"
                      checked={pipedaConsent}
                      onCheckedChange={(v) => setPipedaConsent(v === true)}
                      className="mt-0.5 shrink-0"
                    />
                    <label htmlFor="pipeda" className="text-xs leading-relaxed cursor-pointer" style={{ color: "#6B7070" }}>
                      I consent to ProsperWise collecting and processing my personal information in accordance
                      with the{" "}
                      <span className="font-medium" style={{ color: "#2A4034" }}>
                        Personal Information Protection and Electronic Documents Act (PIPEDA)
                      </span>
                      . My data will be processed in Canadian data centres only.
                    </label>
                  </div>

                  <Button
                    onClick={submitLead}
                    disabled={isSubmitting || !leadForm.first_name || !leadForm.email || !pipedaConsent}
                    className="w-full font-semibold tracking-wide"
                    style={{ backgroundColor: "#2A4034", color: "#F8F6F2", border: "none" }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Request Transition Session →"
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "complete" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <div
                className="rounded-2xl p-8 text-center"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid rgba(42,64,52,0.25)",
                  boxShadow: "0 2px 16px rgba(42,64,52,0.08)",
                }}
              >
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(42,64,52,0.08)", border: "1px solid rgba(42,64,52,0.2)" }}
                >
                  <ShieldCheck className="h-7 w-7" style={{ color: "#2A4034" }} />
                </div>
                <p className="font-serif text-lg font-semibold" style={{ color: "#2A4034" }}>
                  Transition Session Requested
                </p>
                <p className="mt-2 text-sm" style={{ color: "#6B7070" }}>
                  Rolf Issler will reach out within 1–2 business days.
                </p>
                <div
                  className="mx-auto mt-4 inline-block rounded-full px-4 py-1"
                  style={{ backgroundColor: "rgba(169,140,90,0.12)", border: "1px solid rgba(169,140,90,0.3)" }}
                >
                  <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: "#A98C5A" }}>
                    Fee-Only · No Commission · Canada
                  </span>
                </div>
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
          style={{ borderTop: "1px solid #D3C5B7", backgroundColor: "#F8F6F2" }}
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
                border: "1px solid #D3C5B7",
                color: "#3B3F3F",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 1px 4px rgba(59,63,63,0.05)",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: "#2A4034" }}
            >
              <Send className="h-4 w-4" style={{ color: "#F8F6F2" }} />
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] tracking-wide" style={{ color: "#A98C5A" }}>
            Protected by PIPEDA · Data processed in Canada · Fee-Only advisory
          </p>
        </div>
      )}
    </div>
  );
}

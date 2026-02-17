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

export default function Discovery() {
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

  // Auto-greet on mount
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

      // Check for function calls (register_discovery_lead)
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
    <div className="flex min-h-screen flex-col bg-[#05070a] text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#1e293b] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30">
            <span className="text-lg font-serif text-amber-400">G</span>
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold text-amber-50">Georgia</h1>
            <p className="text-[11px] text-slate-400">Discovery Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-950/30 px-3 py-1">
          <Lock className="h-3 w-3 text-emerald-400" />
          <span className="text-[11px] text-emerald-400">Secure Connection</span>
        </div>
      </header>

      {/* Chat Area */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-2xl space-y-4 p-6">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20">
                    <span className="text-sm font-serif text-amber-400">G</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-amber-500/10 text-amber-50 ring-1 ring-amber-500/20"
                      : "bg-[#111318] text-slate-200 ring-1 ring-[#1e293b]"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-p:leading-relaxed">
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20">
                <span className="text-sm font-serif text-amber-400">G</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl bg-[#111318] px-4 py-3 ring-1 ring-[#1e293b]">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400/60 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400/60 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400/60 [animation-delay:300ms]" />
              </div>
            </motion.div>
          )}

          {/* Lead Capture Form */}
          {phase === "lead_capture" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-amber-500/20 bg-[#111318] p-6 ring-1 ring-[#1e293b]"
            >
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-400" />
                <h3 className="font-serif text-base font-semibold text-amber-50">
                  Connect with Rolf
                </h3>
              </div>
              <p className="mb-5 text-sm text-slate-400">
                Please provide your details to schedule your Stabilization Triage session.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    First Name <span className="text-amber-400">*</span>
                  </label>
                  <Input
                    value={leadForm.first_name}
                    onChange={(e) => setLeadForm((f) => ({ ...f, first_name: e.target.value }))}
                    placeholder="Your first name"
                    className="border-[#1e293b] bg-[#05070a] text-white placeholder:text-slate-600 focus-visible:ring-amber-500/40"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Phone Number</label>
                  <Input
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="(555) 555-5555"
                    className="border-[#1e293b] bg-[#05070a] text-white placeholder:text-slate-600 focus-visible:ring-amber-500/40"
                    maxLength={20}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Email <span className="text-amber-400">*</span>
                  </label>
                  <Input
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="border-[#1e293b] bg-[#05070a] text-white placeholder:text-slate-600 focus-visible:ring-amber-500/40"
                    maxLength={255}
                  />
                </div>

                {/* PIPEDA Consent */}
                <div className="flex items-start gap-3 rounded-lg border border-[#1e293b] bg-[#0a0c10] p-3">
                  <Checkbox
                    id="pipeda"
                    checked={pipedaConsent}
                    onCheckedChange={(v) => setPipedaConsent(v === true)}
                    className="mt-0.5 border-slate-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                  <label htmlFor="pipeda" className="text-xs leading-relaxed text-slate-400 cursor-pointer">
                    I consent to ProsperWise collecting and processing my personal information in accordance
                    with the <span className="text-amber-400">Personal Information Protection and Electronic
                    Documents Act (PIPEDA)</span>. My data will be processed in Canadian data centres and
                    will not be shared with third parties.
                  </label>
                </div>

                <Button
                  onClick={submitLead}
                  disabled={isSubmitting || !leadForm.first_name || !leadForm.email || !pipedaConsent}
                  className="w-full bg-amber-500 text-[#05070a] hover:bg-amber-400 font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Request Stabilization Triage"
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Completion */}
          {phase === "complete" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6 text-center"
            >
              <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
              <p className="font-serif text-base text-emerald-50">
                Your Stabilization Triage has been requested.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Rolf Issler will reach out to you within 1–2 business days.
              </p>
            </motion.div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      {phase === "chat" && (
        <div className="border-t border-[#1e293b] p-4">
          <div className="mx-auto flex max-w-2xl items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share what's on your mind..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl border border-[#1e293b] bg-[#111318] px-4 py-3 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 shrink-0 rounded-xl bg-amber-500 text-[#05070a] hover:bg-amber-400"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-slate-600">
            Protected by PIPEDA · Data processed in Canada · Fee-Only advisory
          </p>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Loader2, ShieldCheck, Lock, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

type Message = { role: "user" | "assistant"; content: string };

type Phase = "chat" | "lead_capture" | "complete";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("chat");
  const [leadForm, setLeadForm] = useState({ first_name: "", phone: "", email: "" });
  const [pipedaConsent, setPipedaConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  
  // Ref is kept for manual scrolling if needed later, 
  // but the auto-scroll useEffect has been removed.
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!hasGreeted) {
      setHasGreeted(true);
      sendToGeorgia([{ role: "user", content: "Hello" }], true);
    }
  }, [hasGreeted]);

  async function sendToGeorgia(msgs: Message[], isGreeting = false) {
    setIsLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/discovery-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        },
        body: JSON.stringify({ messages: msgs }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");

      const assistantMsg: Message = { role: "assistant", content: data.text };
      
      // Check if we should move to lead capture based on AI response content 
      // or metadata if your edge function provides it
      if (data.shouldCaptureLead) {
        setPhase("lead_capture");
      }

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      toast.error(error.message || "Connection lost. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    
    setMessages(newMessages);
    setInput("");
    await sendToGeorgia(newMessages);
  };

  const handleSubmitLead = async () => {
    if (!pipedaConsent) {
      toast.error("Please provide consent to proceed.");
      return;
    }
    setIsSubmitting(true);
    // Logic for register_discovery_lead would go here
    setTimeout(() => {
      setPhase("complete");
      setIsSubmitting(false);
      toast.success("Discovery summary transmitted.");
    }, 1500);
  };

  return (
    <div className="flex flex-col h-screen bg-[#05070a] text-slate-200 font-sans">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 bg-slate-900/20 backdrop-blur-md flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="bg-amber-500 p-2 rounded-xl">
            <Bot className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase text-white">Georgia</h1>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-tighter flex items-center">
              <span className="w-1 h-1 bg-emerald-500 rounded-full mr-1 animate-pulse"></span>
              Secure Discovery Agent
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg">
          <Lock className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">PIPEDA / CA</span>
        </div>
      </header>

      {/* Main Chat Area */}
      <ScrollArea className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`mt-1 p-2 rounded-lg h-fit ${msg.role === "user" ? "bg-slate-800" : "bg-amber-500"}`}>
                    {msg.role === "user" ? <User className="w-4 h-4 text-slate-400" /> : <Bot className="w-4 h-4 text-slate-950" />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed border ${
                    msg.role === "user" 
                      ? "bg-slate-900/50 border-slate-800 text-slate-200" 
                      : "bg-slate-950 border-slate-800 text-slate-300"
                  }`}>
                    <ReactMarkdown className="prose prose-invert prose-sm">{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              </div>
            </div>
          )}
          {/* Scroll anchor remains, but no useEffect targets it now */}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input / Lead Form Area */}
      <div className="p-4 md:p-6 border-t border-slate-800 bg-slate-900/40 backdrop-blur-lg">
        <div className="max-w-3xl mx-auto">
          {phase === "chat" && (
            <div className="relative flex items-center">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Reply to Georgia..."
                className="bg-slate-950 border-slate-800 py-6 pr-14 rounded-2xl focus-visible:ring-amber-500"
                disabled={isLoading}
              />
              <Button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="absolute right-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}

          {phase === "lead_capture" && (
            <Card className="bg-slate-950 border-slate-800 border-2 overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-2 text-amber-500 mb-2">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Stabilization Triage Request</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    placeholder="First Name" 
                    value={leadForm.first_name}
                    onChange={(e) => setLeadForm({...leadForm, first_name: e.target.value})}
                    className="bg-slate-900 border-slate-800"
                  />
                  <Input 
                    placeholder="Phone Number" 
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({...leadForm, phone: e.target.value})}
                    className="bg-slate-900 border-slate-800"
                  />
                </div>
                <Input 
                  placeholder="Email Address" 
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({...leadForm, email: e.target.value})}
                  className="bg-slate-900 border-slate-800"
                />
                <div className="flex items-start space-x-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                  <Checkbox 
                    id="consent" 
                    checked={pipedaConsent}
                    onCheckedChange={(checked) => setPipedaConsent(!!checked)}
                    className="mt-1 border-slate-600 data-[state=checked]:bg-amber-500"
                  />
                  <label htmlFor="consent" className="text-[10px] text-slate-400 leading-tight font-medium uppercase">
                    I consent to having my transition details securely reviewed by the Personal CFO within the Canadian Sovereignty Network.
                  </label>
                </div>
                <Button 
                  onClick={handleSubmitLead}
                  disabled={isSubmitting || !pipedaConsent || !leadForm.email}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold uppercase tracking-widest py-6 rounded-xl"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Transmit Discovery Summary"}
                </Button>
              </CardContent>
            </Card>
          )}

          {phase === "complete" && (
            <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-white font-bold uppercase tracking-widest text-sm">Protocol Complete</h3>
              <p className="text-xs text-slate-400">Rolf Issler will contact you shortly for your alignment call.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}      if (isGreeting) {
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/30">
            <span className="text-lg font-serif text-accent">G</span>
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold text-foreground">Georgia</h1>
            <p className="text-[11px] text-muted-foreground">Discovery Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1">
          <Lock className="h-3 w-3 text-primary" />
          <span className="text-[11px] text-primary">Secure Connection</span>
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
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                    <span className="text-sm font-serif text-accent">G</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground ring-1 ring-border"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-p:leading-relaxed">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                <span className="text-sm font-serif text-accent">G</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-3 ring-1 ring-border">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:300ms]" />
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
              <Card className="border-accent/20">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-accent" />
                    <h3 className="font-serif text-base font-semibold text-foreground">
                      Connect with Rolf
                    </h3>
                  </div>
                  <p className="mb-5 text-sm text-muted-foreground">
                    Please provide your details to schedule your Stabilization Triage session.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        First Name <span className="text-accent">*</span>
                      </label>
                      <Input
                        value={leadForm.first_name}
                        onChange={(e) => setLeadForm((f) => ({ ...f, first_name: e.target.value }))}
                        placeholder="Your first name"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Phone Number</label>
                      <Input
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="(555) 555-5555"
                        maxLength={20}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Email <span className="text-accent">*</span>
                      </label>
                      <Input
                        type="email"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                        maxLength={255}
                      />
                    </div>

                    {/* PIPEDA Consent */}
                    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3">
                      <Checkbox
                        id="pipeda"
                        checked={pipedaConsent}
                        onCheckedChange={(v) => setPipedaConsent(v === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor="pipeda" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
                        I consent to ProsperWise collecting and processing my personal information in accordance
                        with the <span className="text-accent font-medium">Personal Information Protection and Electronic
                        Documents Act (PIPEDA)</span>. My data will be processed in Canadian data centres and
                        will not be shared with third parties.
                      </label>
                    </div>

                    <Button
                      onClick={submitLead}
                      disabled={isSubmitting || !leadForm.first_name || !leadForm.email || !pipedaConsent}
                      className="w-full"
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
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Completion */}
          {phase === "complete" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Card className="border-primary/20 bg-primary/5 text-center">
                <CardContent className="p-6">
                  <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-primary" />
                  <p className="font-serif text-base text-foreground">
                    Your Stabilization Triage has been requested.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Rolf Issler will reach out to you within 1–2 business days.
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
        <div className="border-t border-border p-4">
          <div className="mx-auto flex max-w-2xl items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share what's on your mind..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 shrink-0 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-muted-foreground">
            Protected by PIPEDA · Data processed in Canada · Fee-Only advisory
          </p>
        </div>
      )}
    </div>
  );
}

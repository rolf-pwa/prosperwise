import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PortalTerritory } from "@/components/portal/PortalTerritory";
import { PortalMeetings } from "@/components/portal/PortalMeetings";
import { PortalCharter } from "@/components/portal/PortalCharter";
import { PortalTimeline } from "@/components/portal/PortalTimeline";
import { PortalTasks } from "@/components/portal/PortalTasks";
import { PhaseProgressStepper, PhaseData } from "@/components/portal/PhaseProgressStepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Grape, ScrollText, Clock, Shield, Calendar, FolderOpen,
  CheckSquare, ShieldCheck, MessageCircle, ExternalLink,
  FileBarChart, Mail, Loader2,
} from "lucide-react";

// ─── Sanctuary palette ────────────────────────────────────────────────────────
const S = {
  bg:         "#05070a",
  card:       "#0c0f14",
  border:     "rgba(255,255,255,0.07)",
  amber:      "#F59E0B",
  amberDim:   "rgba(245,158,11,0.12)",
  text:       "rgba(255,255,255,0.88)",
  muted:      "rgba(255,255,255,0.38)",
  mutedBorder:"rgba(255,255,255,0.05)",
};

// Phase labels that map to Asana section names (case-insensitive includes)
const PHASE_SECTION_KEYWORDS: { id: string; keywords: string[] }[] = [
  { id: "A", keywords: ["phase a", "transition session", "transition"] },
  { id: "B", keywords: ["phase b", "charter process", "charter"] },
  { id: "C", keywords: ["phase c", "charter funding", "funding"] },
  { id: "D", keywords: ["phase d", "household governance", "governance"] },
  { id: "E", keywords: ["phase e", "individuals"] },
];

interface PortalData {
  contact: any;
  vineyard_accounts: any[];
  storehouses: any[];
  audit_trail: any[];
  meetings: any[];
  family: any | null;
  household: any | null;
  household_members: any[];
}

// ─────────────────────────────────────────────────────────────────────────────

const Portal = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [activeTab, setActiveTab] = useState("territory");

  // OTP
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Phase stepper
  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [phasesLoading, setPhasesLoading] = useState(false);
  // Notification badge
  const [hasOpenTasks, setHasOpenTasks] = useState(false);
  const [tasksChecked, setTasksChecked] = useState(false);

  // ── Token-based access ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const resp = await supabase.functions.invoke("portal-validate", {
          body: { token },
        });
        if (resp.error || resp.data?.error) {
          setError(resp.data?.error || "Invalid link");
        } else {
          setData(resp.data);
        }
      } catch {
        setError("Unable to load portal");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ── Load phase progress + task badge once we have a token ────────────────
  useEffect(() => {
    const portalToken = token;
    if (!portalToken) return;

    // Load phase data from Asana sections
    (async () => {
      setPhasesLoading(true);
      try {
        const res = await supabase.functions.invoke("asana-service", {
          body: { action: "getPhaseProgress", portal_token: portalToken },
        });
        if (!res.error && res.data?.data) {
          setPhases(res.data.data as PhaseData[]);
        }
      } catch { /* silent */ }
      finally { setPhasesLoading(false); }
    })();

    // Check for open client-visible tasks (for badge)
    (async () => {
      try {
        const res = await supabase.functions.invoke("asana-service", {
          body: { action: "getTasksForProject", portal_token: portalToken },
        });
        if (!res.error && res.data?.data) {
          const tasks = res.data.data as any[];
          setHasOpenTasks(tasks.some((t: any) => !t.completed));
        }
      } catch { /* silent */ }
      finally { setTasksChecked(true); }
    })();
  }, [token]);

  const handleSendOtp = async () => {
    if (!email.trim()) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const resp = await supabase.functions.invoke("portal-otp", {
        body: { action: "send", email: email.trim() },
      });
      if (resp.error) throw resp.error;
      setOtpSent(true);
    } catch {
      setOtpError("Something went wrong. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const resp = await supabase.functions.invoke("portal-otp", {
        body: { action: "verify", email: email.trim(), code: otp },
      });
      if (resp.error || resp.data?.error) {
        setOtpError(resp.data?.error || "Invalid code. Please try again.");
      } else {
        setData(resp.data);
      }
    } catch {
      setOtpError("Something went wrong. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // ── OTP Login Screen ─────────────────────────────────────────────────────
  if (!token && !data) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: S.bg }}
      >
        <div className="mx-4 w-full max-w-md space-y-8 text-center">
          <div className="space-y-3">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: S.amberDim }}
            >
              <Shield className="h-8 w-8" style={{ color: S.amber }} />
            </div>
            <h1 className="text-3xl font-bold font-serif" style={{ color: S.text }}>
              Sovereign Portal
            </h1>
            <p className="text-sm" style={{ color: S.muted }}>
              ProsperWise Advisors — Secure Client Access
            </p>
            <p
              className="text-xs italic px-4 leading-relaxed"
              style={{ color: "rgba(245,158,11,0.6)" }}
            >
              "Prosperity is a state of being, not the size of your portfolio."
            </p>
          </div>

          <div
            className="rounded-2xl border p-8 text-left space-y-5"
            style={{ background: S.card, borderColor: S.border }}
          >
            {!otpSent ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: S.text }}>Email Address</label>
                  <p className="text-xs" style={{ color: S.muted }}>
                    Enter the email on file with your Personal CFO.
                  </p>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    disabled={otpLoading}
                    className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${S.border}`,
                      color: S.text,
                    }}
                  />
                </div>
                {otpError && <p className="text-xs text-red-400">{otpError}</p>}
                <button
                  onClick={handleSendOtp}
                  disabled={otpLoading || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-40"
                  style={{ background: S.amber, color: "#0c0f14" }}
                >
                  {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send Access Code
                </button>
              </>
            ) : (
              <>
                <div className="space-y-2 text-center">
                  <Mail className="h-8 w-8 mx-auto" style={{ color: S.amber }} />
                  <p className="text-sm font-medium" style={{ color: S.text }}>Check your email</p>
                  <p className="text-xs" style={{ color: S.muted }}>
                    We sent a 6-digit code to{" "}
                    <span className="font-medium" style={{ color: S.text }}>{email}</span>
                  </p>
                </div>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {otpError && <p className="text-xs text-red-400 text-center">{otpError}</p>}
                <button
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || otp.length !== 6}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-40"
                  style={{ background: S.amber, color: "#0c0f14" }}
                >
                  {otpLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verify & Enter Sanctuary
                </button>
                <button
                  onClick={() => { setOtpSent(false); setOtp(""); setOtpError(null); }}
                  className="w-full text-xs transition-colors"
                  style={{ color: S.muted }}
                >
                  Use a different email
                </button>
              </>
            )}
          </div>

          <p className="text-xs" style={{ color: S.muted }}>
            Code expires in 10 minutes · Max 3 requests per hour
          </p>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: S.bg }}
      >
        <div className="flex flex-col items-center gap-4">
          <Shield className="h-10 w-10 animate-pulse" style={{ color: S.amber }} />
          <p className="text-sm" style={{ color: S.muted }}>
            Loading your Financial Territory…
          </p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data?.contact) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: S.bg }}
      >
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 mx-auto" style={{ color: S.muted }} />
          <h1 className="text-xl font-semibold font-serif" style={{ color: S.text }}>
            Access Denied
          </h1>
          <p className="text-sm max-w-sm" style={{ color: S.muted }}>
            {error || "This portal link is invalid or has expired."}
          </p>
        </div>
      </div>
    );
  }

  const { contact, vineyard_accounts, storehouses, audit_trail, meetings, family, household, household_members } = data;

  return (
    <div className="min-h-screen" style={{ background: S.bg, color: S.text }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-10 backdrop-blur-md border-b"
        style={{
          background: "rgba(5,7,10,0.85)",
          borderColor: S.border,
        }}
      >
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: S.amberDim }}
              >
                <Shield className="h-5 w-5" style={{ color: S.amber }} />
              </div>
              <div>
                <h1 className="text-base font-semibold font-serif" style={{ color: S.text }}>
                  {contact.first_name} {contact.last_name || ""}
                </h1>
                <p className="text-xs" style={{ color: S.muted }}>
                  {family?.name ? `${family.name} — ` : ""}
                  {household?.label ? `${household.label} Household` : "Sovereign Financial Territory"}
                </p>
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-medium border"
              style={{
                background: S.amberDim,
                color: S.amber,
                borderColor: "rgba(245,158,11,0.2)",
              }}
            >
              {contact.governance_status === "stabilization" ? "Stabilization" : "Sovereign"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Quick Links nav ─────────────────────────────────────────────────── */}
      <nav
        className="border-b"
        style={{ background: "rgba(255,255,255,0.02)", borderColor: S.border }}
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            {/* Meetings */}
            <button
              onClick={() => setActiveTab("meetings")}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors"
              style={{
                color: activeTab === "meetings" ? S.amber : S.muted,
                background: activeTab === "meetings" ? S.amberDim : "transparent",
              }}
            >
              <Calendar className="h-3.5 w-3.5" />
              Meetings
              {meetings.length > 0 && (
                <span
                  className="rounded-full px-1.5 text-[10px] font-semibold"
                  style={{ background: S.amberDim, color: S.amber }}
                >
                  {meetings.length}
                </span>
              )}
            </button>

            {/* External links */}
            {[
              { href: contact.sidedrawer_url, label: "Documents", icon: FolderOpen },
              { href: contact.ia_financial_url, label: "Accounts", icon: ShieldCheck },
            ].map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  color: href ? S.muted : "rgba(255,255,255,0.18)",
                  pointerEvents: href ? "auto" : "none",
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {href && <ExternalLink className="h-3 w-3 opacity-40" />}
              </a>
            ))}

            {/* Tasks — with red notification dot */}
            <button
              onClick={() => setActiveTab("tasks")}
              className="relative flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors"
              style={{
                color: activeTab === "tasks" ? S.amber : S.muted,
                background: activeTab === "tasks" ? S.amberDim : "transparent",
              }}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Tasks
              {tasksChecked && hasOpenTasks && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
              )}
            </button>

            <span
              className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium cursor-default"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Support
              <span className="text-[10px]">(coming soon)</span>
            </span>
          </div>
        </div>
      </nav>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">

        {/* Phase Progress Stepper — always visible */}
        {token && (
          <PhaseProgressStepper phases={phases} loading={phasesLoading} />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            className="w-full"
            style={{
              background: S.card,
              border: `1px solid ${S.border}`,
            }}
          >
            {[
              { value: "territory", icon: Grape, label: "Territory" },
              { value: "charter",   icon: ScrollText, label: "Charter" },
              { value: "timeline",  icon: Clock, label: "Timeline" },
              { value: "reviews",   icon: FileBarChart, label: "Reviews" },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-1 text-xs gap-1.5 data-[state=active]:text-amber-400"
                style={{ color: S.muted }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="territory" className="mt-6">
            <PortalTerritory
              vineyardAccounts={vineyard_accounts}
              storehouses={storehouses}
              contact={contact}
              family={family}
              household={household}
              householdMembers={household_members}
            />
          </TabsContent>

          <TabsContent value="meetings" className="mt-6">
            <PortalMeetings meetings={meetings} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <PortalTasks portalToken={token!} />
          </TabsContent>

          <TabsContent value="charter" className="mt-6">
            <PortalCharter googleDriveUrl={contact.google_drive_url} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <PortalTimeline auditTrail={audit_trail} />
          </TabsContent>

          <TabsContent value="reviews" className="mt-6">
            <div
              className="flex flex-col items-center justify-center rounded-xl border px-6 py-16 text-center"
              style={{ background: S.card, borderColor: S.border }}
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full mb-4"
                style={{ background: S.amberDim }}
              >
                <FileBarChart className="h-7 w-7" style={{ color: S.amber }} />
              </div>
              <h3 className="text-lg font-semibold font-serif mb-2" style={{ color: S.text }}>
                Quarterly Governance Reviews
              </h3>
              <p className="text-sm max-w-md mb-1" style={{ color: S.muted }}>
                Comprehensive AI-powered reviews of your financial territory — account statements,
                governance alignment, and strategic recommendations.
              </p>
              <span
                className="inline-block rounded-full px-3 py-1 text-xs font-medium mt-3 border"
                style={{ background: S.amberDim, color: S.amber, borderColor: "rgba(245,158,11,0.2)" }}
              >
                Coming Soon
              </span>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t mt-12" style={{ borderColor: S.border }}>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 text-center space-y-1">
          <p className="text-xs" style={{ color: S.muted }}>
            ProsperWise Advisors — Your Personal CFO
          </p>
          <p className="text-[11px] italic" style={{ color: "rgba(245,158,11,0.45)" }}>
            "Prosperity is a state of being, not the size of your portfolio."
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Portal;

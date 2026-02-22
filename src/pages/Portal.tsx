import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PortalTerritory } from "@/components/portal/PortalTerritory";
import { PortalRequests } from "@/components/portal/PortalRequests";
import { PortalMeetings } from "@/components/portal/PortalMeetings";
import { PortalCharter } from "@/components/portal/PortalCharter";
import { PortalTimeline } from "@/components/portal/PortalTimeline";
import { PortalTasks } from "@/components/portal/PortalTasks";
import { PortalGeorgiaChat } from "@/components/portal/PortalGeorgiaChat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Grape, ScrollText, Clock, Shield, Calendar, FolderOpen, CheckSquare, ShieldCheck, ExternalLink, FileBarChart, Mail, Loader2, Home, Users, ChevronLeft, ArrowRight, Landmark, MessageCircle, Video, MapPin, ClipboardList } from "lucide-react";

interface PortalData {
  portal_token?: string;
  contact: any;
  vineyard_accounts: any[];
  storehouses: any[];
  audit_trail: any[];
  portal_requests: any[];
  meetings: any[];
  family: any | null;
  household: any | null;
  household_members: any[];
  hierarchy?: any;
}

const ROLE_LABELS: Record<string, string> = {
  head_of_family: "Head of Family",
  spouse: "Spouse",
  beneficiary: "Beneficiary",
  minor: "Minor",
};

// ─── Drill-down view types ───
type ViewLevel = "family" | "household" | "individual";

interface DrilldownState {
  level: ViewLevel;
  householdId?: string;
  memberId?: string;
}

const Portal = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [activeTab, setActiveTab] = useState("overview");

  // Drill-down state
  const [drilldown, setDrilldown] = useState<DrilldownState>({ level: "individual" });
  const [georgiaOpen, setGeorgiaOpen] = useState(false);

  // OTP login state
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Refresh portal data (after scope change etc.)
  const refreshData = async (currentToken: string) => {
    try {
      const resp = await supabase.functions.invoke("portal-validate", {
        body: { token: currentToken },
      });
      if (!resp.error && !resp.data?.error) {
        setData(resp.data);
      }
    } catch {}
  };

  // Legacy token-based access (for advisor "View Portal" bypass)
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
          // Set initial drilldown level based on hierarchy
          const level = resp.data?.hierarchy?.level || "individual";
          setDrilldown({ level });
        }
      } catch {
        setError("Unable to load portal");
      } finally {
        setLoading(false);
      }
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
        const level = resp.data?.hierarchy?.level || "individual";
        setDrilldown({ level });
      }
    } catch {
      setOtpError("Something went wrong. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // --- OTP Login Screen ---
  if (!token && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-4 w-full max-w-md space-y-8 text-center">
          <div className="space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
              <Shield className="h-8 w-8 text-accent" />
            </div>
            <h1 className="text-3xl font-bold text-foreground font-serif">
              Sovereign Portal
            </h1>
            <p className="text-sm text-muted-foreground">
              ProsperWise Advisors — Secure Client Access
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-8 text-left space-y-5">
            {!otpSent ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email Address</label>
                  <p className="text-xs text-muted-foreground">
                    Enter the email on file with your Personal CFO.
                  </p>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    disabled={otpLoading}
                  />
                </div>
                {otpError && <p className="text-xs text-destructive">{otpError}</p>}
                <Button onClick={handleSendOtp} disabled={otpLoading || !email.trim()} className="w-full" size="lg">
                  {otpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send Access Code
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2 text-center">
                  <Mail className="h-8 w-8 text-accent mx-auto" />
                  <p className="text-sm text-foreground font-medium">Check your email</p>
                  <p className="text-xs text-muted-foreground">
                    We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
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
                {otpError && <p className="text-xs text-destructive text-center">{otpError}</p>}
                <Button onClick={handleVerifyOtp} disabled={otpLoading || otp.length !== 6} className="w-full" size="lg">
                  {otpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verify & Enter Portal
                </Button>
                <button
                  onClick={() => { setOtpSent(false); setOtp(""); setOtpError(null); }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Use a different email
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Code expires in 10 minutes · Max 3 requests per hour
          </p>
        </div>
      </div>
    );
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Shield className="h-10 w-10 text-accent animate-pulse" />
          <p className="text-muted-foreground text-sm">Loading your Financial Territory…</p>
        </div>
      </div>
    );
  }

  if (error || !data?.contact) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground text-sm max-w-sm">
            {error || "This portal link is invalid or has expired. Please contact your Personal CFO for a new link."}
          </p>
        </div>
      </div>
    );
  }

  const { contact, vineyard_accounts, storehouses, audit_trail, portal_requests, meetings, family, household, household_members, hierarchy } = data;
  const portalToken = token || data.portal_token || "";
  const hierarchyLevel = hierarchy?.level || "individual";

  // Determine current view context
  const currentHousehold = drilldown.householdId
    ? hierarchy?.households?.find((h: any) => h.id === drilldown.householdId)
    : null;
  const currentMember = drilldown.memberId
    ? (currentHousehold?.members || hierarchy?.members || []).find((m: any) => m.id === drilldown.memberId)
    : null;

  // Breadcrumb navigation
  const renderBreadcrumb = () => {
    if (drilldown.level === "family" && hierarchyLevel === "family") return null;
    
    return (
      <div className="flex items-center gap-2 text-sm mb-4">
        {hierarchyLevel === "family" && (drilldown.level === "household" || drilldown.level === "individual") && (
          <button
            onClick={() => setDrilldown({ level: "family" })}
            className="flex items-center gap-1 text-accent hover:underline"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {family?.name || "Family"}
          </button>
        )}
        {drilldown.level === "individual" && drilldown.householdId && (
          <>
            <span className="text-muted-foreground">/</span>
            <button
              onClick={() => setDrilldown({ level: "household", householdId: drilldown.householdId })}
              className="text-accent hover:underline"
            >
              {currentHousehold?.label || "Household"}
            </button>
          </>
        )}
        {drilldown.level === "individual" && currentMember && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground font-medium">{currentMember.first_name} {currentMember.last_name || ""}</span>
          </>
        )}
      </div>
    );
  };

  // Helper: aggregate assets from hierarchy at a given scope level
  const aggregateAssetsAtLevel = (level: "family" | "household", householdId?: string) => {
    const allVineyard: any[] = [];
    const allStorehouses: any[] = [];

    if (level === "family") {
      // Family level: only family_shared assets across all households
      const households = hierarchy?.households || [];
      households.forEach((hh: any) => {
        (hh.members || []).forEach((m: any) => {
          (m.vineyard_accounts || []).filter((a: any) => a.visibility_scope === "family_shared").forEach((a: any) => allVineyard.push(a));
          (m.storehouses || []).filter((a: any) => a.visibility_scope === "family_shared").forEach((a: any) => allStorehouses.push(a));
        });
      });
    } else if (level === "household") {
      // Household level: household_shared + family_shared assets from household members
      const members = householdId
        ? (hierarchy?.households?.find((h: any) => h.id === householdId)?.members || [])
        : (hierarchy?.members || []);
      // Include self's assets too
      const selfVineyard = vineyard_accounts.filter((a: any) => a.visibility_scope === "household_shared" || a.visibility_scope === "family_shared");
      const selfStorehouses = storehouses.filter((a: any) => a.visibility_scope === "household_shared" || a.visibility_scope === "family_shared");
      allVineyard.push(...selfVineyard);
      allStorehouses.push(...selfStorehouses);
      members.forEach((m: any) => {
        (m.vineyard_accounts || []).filter((a: any) => a.visibility_scope === "household_shared" || a.visibility_scope === "family_shared").forEach((a: any) => allVineyard.push(a));
        (m.storehouses || []).filter((a: any) => a.visibility_scope === "household_shared" || a.visibility_scope === "family_shared").forEach((a: any) => allStorehouses.push(a));
      });
    }

    return { vineyard: allVineyard, storehouses: allStorehouses };
  };

  // ─── Family Overview (drill-down landing) ───
  const renderFamilyView = () => {
    const households = hierarchy?.households || [];
    const familyAssets = aggregateAssetsAtLevel("family");
    
    // Aggregate financials across all households (family_shared only)
    const totalAssets = familyAssets.vineyard.reduce((s: number, a: any) => s + (Number(a.current_value) || 0), 0)
      + familyAssets.storehouses.reduce((s: number, a: any) => s + (Number(a.current_value) || 0), 0);

    return (
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content: Summary + Household Cards */}
        <div className="space-y-6 lg:col-span-2">
          {/* Family Summary */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Home className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground font-serif">{family?.name || "Family"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {households.length} household{households.length !== 1 ? "s" : ""} · {households.reduce((s: number, h: any) => s + (h.members?.length || 0), 0)} members
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-bold text-accent">${totalAssets.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Family Shared Assets</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Household Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {households.map((hh: any) => {
              const members = hh.members || [];
              const hhTotal = members.reduce((sum: number, m: any) => {
                const vTotal = (m.vineyard_accounts || [])
                  .filter((a: any) => a.visibility_scope === "family_shared")
                  .reduce((s: number, a: any) => s + (Number(a.current_value) || 0), 0);
                const sTotal = (m.storehouses || [])
                  .filter((a: any) => a.visibility_scope === "family_shared")
                  .reduce((s: number, a: any) => s + (Number(a.current_value) || 0), 0);
                return sum + vTotal + sTotal;
              }, 0);

              return (
                <button
                  key={hh.id}
                  onClick={() => setDrilldown({ level: "household", householdId: hh.id })}
                  className="text-left rounded-lg border border-border bg-card p-5 hover:border-accent/30 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-accent" />
                      <h3 className="font-semibold text-foreground font-serif">{hh.label} Household</h3>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {hh.address && (
                    <p className="text-xs text-muted-foreground mb-3">{hh.address}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {members.length} member{members.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">${hhTotal.toLocaleString()}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {members.slice(0, 4).map((m: any) => (
                      <span key={m.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {m.first_name}
                      </span>
                    ))}
                    {members.length > 4 && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        +{members.length - 4}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Family-Shared Territory */}
        <div className="space-y-4">
          <PortalTerritory
            vineyardAccounts={familyAssets.vineyard}
            storehouses={familyAssets.storehouses}
            contact={contact}
            family={family}
            household={null}
            householdMembers={[]}
            scopeLabel="Family Shared"
            portalToken={portalToken}
            onScopeChange={() => refreshData(portalToken)}
          />
        </div>
      </div>
    );
  };

  // ─── Household View (shows member cards + territory sidebar) ───
  const renderHouseholdView = () => {
    const members = currentHousehold?.members || hierarchy?.members || [];
    const hhLabel = currentHousehold?.label || household?.label || "Household";
    const hhAssets = aggregateAssetsAtLevel("household", drilldown.householdId);

    return (
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content: Household info + member cards */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Home className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground font-serif">{hhLabel} Household</h2>
                  <p className="text-xs text-muted-foreground">
                    {members.length + 1} member{members.length !== 0 ? "s" : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Member cards — ordered: Head, Spouse, Beneficiary, Minor */}
          <div className="grid gap-3">
            {[
              { ...contact, _isSelf: true },
              ...members.map((m: any) => ({ ...m, _isSelf: false })),
            ]
              .sort((a: any, b: any) => {
                const order: Record<string, number> = { head_of_family: 0, spouse: 1, beneficiary: 2, minor: 3 };
                return (order[a.family_role] ?? 4) - (order[b.family_role] ?? 4);
              })
              .map((m: any) => {
                const isSelf = m._isSelf;
                const mTotal = isSelf
                  ? 0
                  : (m.vineyard_accounts || [])
                      .filter((a: any) => a.visibility_scope === "household_shared" || a.visibility_scope === "family_shared")
                      .reduce((s: number, a: any) => s + (Number(a.current_value) || 0), 0)
                    + (m.storehouses || [])
                      .filter((a: any) => a.visibility_scope === "household_shared" || a.visibility_scope === "family_shared")
                      .reduce((s: number, a: any) => s + (Number(a.current_value) || 0), 0);

                return (
                  <button
                    key={m.id}
                    onClick={() =>
                      setDrilldown({
                        level: "individual",
                        householdId: drilldown.householdId,
                        memberId: isSelf ? undefined : m.id,
                      })
                    }
                    className={`text-left rounded-lg p-4 transition-colors group ${
                      isSelf
                        ? "border border-accent/30 bg-accent/5 hover:bg-accent/10"
                        : "border border-border bg-card hover:border-accent/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isSelf ? "bg-accent/20" : "bg-muted"}`}>
                          {isSelf ? <Shield className="h-4 w-4 text-accent" /> : <Users className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.first_name} {m.last_name || ""}</p>
                          <p className="text-xs text-muted-foreground">
                            {ROLE_LABELS[m.family_role] || m.family_role}
                            {isSelf ? " · You" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {!isSelf && <span className="text-sm font-semibold text-foreground">${mTotal.toLocaleString()}</span>}
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                );
              })
            }
          </div>
        </div>

        {/* Right Sidebar: Household-Shared Territory */}
        <div className="space-y-4">
          <PortalTerritory
            vineyardAccounts={hhAssets.vineyard}
            storehouses={hhAssets.storehouses}
            contact={contact}
            family={family}
            household={currentHousehold || household}
            householdMembers={[]}
            scopeLabel="Household Shared"
            portalToken={portalToken}
            onScopeChange={() => refreshData(portalToken)}
          />
        </div>
      </div>
    );
  };

  // ─── Individual View (tasks + meetings main, territory sidebar) ───
  const getIndividualData = () => {
    if (currentMember) {
      // Viewing another member's data
      return {
        name: `${currentMember.first_name} ${currentMember.last_name || ""}`.trim(),
        role: currentMember.family_role,
        vineyardAccounts: currentMember.vineyard_accounts || [],
        memberStorehouses: currentMember.storehouses || [],
      };
    }
    // Viewing self
    return {
      name: `${contact.first_name} ${contact.last_name || ""}`.trim(),
      role: contact.family_role,
      vineyardAccounts: vineyard_accounts,
      memberStorehouses: storehouses,
    };
  };

  const renderIndividualView = () => {
    const ind = getIndividualData();
    const isSelf = !currentMember;

    return (
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content: Tabbed Interface */}
        <div className="space-y-4 lg:col-span-2">
          {/* Ask for Help — pinned above tabs */}
          {isSelf && (
            <Button
              variant="outline"
              onClick={() => setGeorgiaOpen(true)}
              className="w-full justify-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Ask for Help
            </Button>
          )}

          {/* Main Tabs */}
          <Tabs defaultValue="tasks" className="w-full">
            <TabsList className="w-full bg-muted border border-border">
              <TabsTrigger value="tasks" className="flex-1 gap-1.5">
                <CheckSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Action Items</span>
                <span className="sm:hidden">Tasks</span>
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex-1 gap-1.5">
                <ClipboardList className="h-4 w-4" />
                Requests
              </TabsTrigger>
              <TabsTrigger value="meetings" className="flex-1 gap-1.5">
                <Calendar className="h-4 w-4" />
                Meetings
              </TabsTrigger>
              <TabsTrigger value="reviews" className="flex-1 gap-1.5">
                <FileBarChart className="h-4 w-4" />
                Reviews
              </TabsTrigger>
            </TabsList>

            {/* Action Items Tab */}
            <TabsContent value="tasks" className="mt-4">
              {isSelf ? (
                <PortalTasks portalToken={portalToken} />
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                  <CheckSquare className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Task view is only available for your own account.</p>
                </div>
              )}
            </TabsContent>

            {/* Requests Tab */}
            <TabsContent value="requests" className="mt-4">
              {isSelf ? (
                <PortalRequests
                  requests={portal_requests || []}
                  contactId={contact.id}
                  contactName={`${contact.first_name} ${contact.last_name || ""}`.trim()}
                  portalToken={portalToken}
                  onUpdate={() => refreshData(portalToken)}
                />
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                  <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Requests are only visible on your own view.</p>
                </div>
              )}
            </TabsContent>

            {/* Meetings Tab */}
            <TabsContent value="meetings" className="mt-4">
              {isSelf && (
                <div className="flex items-center justify-end gap-2 mb-4">
                  <a
                    href="https://calendar.app.google/EwH29qfci75yedju8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors border border-accent/20"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    In Person
                  </a>
                  <a
                    href="https://calendar.app.google/HgYuTusrWbomsfsC8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors border border-accent/20"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Video
                  </a>
                </div>
              )}
              {isSelf ? (
                <PortalMeetings meetings={meetings} />
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Meeting schedule is only visible on your own view.</p>
                </div>
              )}
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="mt-4">
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 mb-4">
                  <FileBarChart className="h-7 w-7 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground font-serif mb-2">Quarterly Governance Reviews</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-1">
                  Comprehensive AI-powered reviews of your financial territory.
                </p>
                <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent mt-3 border border-accent/20">
                  Coming Soon
                </span>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Family Tile — top of sidebar */}
          {family && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                    <Home className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground font-serif">{family.name}</p>
                    {household && (
                      <p className="text-xs text-muted-foreground">{household.label} Household</p>
                    )}
                  </div>
                </div>
                {household_members.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-muted-foreground">Members</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {household_members.map((m: any) => (
                        <span key={m.id} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground border border-border">
                          {m.first_name} {m.last_name || ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Charter */}
          <PortalCharter charterUrl={contact.charter_url} />

          {/* Quick Links */}
          {isSelf && (
            <div className="flex flex-col gap-1.5">
              {[
                { href: contact.sidedrawer_url, label: "My Documents", icon: FolderOpen },
                { href: "https://clients.ia.ca/account/login", label: "My Accounts", icon: Landmark },
              ].map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-medium transition-colors ${
                    href
                      ? "text-foreground hover:bg-muted/50"
                      : "pointer-events-none text-muted-foreground/40"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {href && <ExternalLink className="ml-auto h-3 w-3 opacity-40" />}
                </a>
              ))}
            </div>
          )}

          {/* Vineyard & Storehouses */}
          <PortalTerritory
            vineyardAccounts={ind.vineyardAccounts}
            storehouses={ind.memberStorehouses}
            contact={isSelf ? contact : currentMember}
            family={family}
            household={household}
            householdMembers={[]}
            scopeLabel={isSelf ? "My Territory" : `${currentMember?.first_name || ""}'s Territory`}
            portalToken={portalToken}
            onScopeChange={() => refreshData(portalToken)}
          />

          {/* Timeline — bottom of sidebar */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Timeline</h3>
            </div>
            <PortalTimeline auditTrail={audit_trail} />
          </div>
        </div>
      </div>
    );
  };

  // ─── Determine what to render based on drilldown ───
  const renderContent = () => {
    if (drilldown.level === "family" && hierarchyLevel === "family") {
      return renderFamilyView();
    }
    if (drilldown.level === "household") {
      return renderHouseholdView();
    }
    return renderIndividualView();
  };

  // Header subtitle based on current view
  const getHeaderSubtitle = () => {
    if (drilldown.level === "family") return family?.name ? `${family.name} — Family Overview` : "Family Overview";
    if (drilldown.level === "household") {
      const label = currentHousehold?.label || household?.label || "";
      return `${label} Household`;
    }
    if (currentMember) return `${currentMember.first_name} ${currentMember.last_name || ""}`;
    return family?.name ? `${family.name} — ${household?.label || ""}` : "Sovereign Financial Territory";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground font-serif">
                  {contact.first_name} {contact.last_name || ""}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {getHeaderSubtitle()}
                </p>
              </div>
            </div>
            {/* Status removed per design */}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {renderBreadcrumb()}
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 text-center">
          <p className="text-xs text-muted-foreground">
            ProsperWise Advisors — Your Personal CFO
          </p>
        </div>
      </footer>

      <PortalGeorgiaChat
        open={georgiaOpen}
        onOpenChange={setGeorgiaOpen}
        contactName={contact.first_name}
        contactId={contact.id}
        onRequestSubmitted={() => refreshData(portalToken)}
      />
    </div>
  );
};

export default Portal;

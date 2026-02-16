import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PortalTerritory } from "@/components/portal/PortalTerritory";
import { PortalMeetings } from "@/components/portal/PortalMeetings";
import { PortalCharter } from "@/components/portal/PortalCharter";
import { PortalTimeline } from "@/components/portal/PortalTimeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grape, ScrollText, Clock, Shield, Calendar, FolderOpen, CheckSquare, ShieldCheck, MessageCircle, ExternalLink } from "lucide-react";

interface PortalData {
  contact: any;
  vineyard_accounts: any[];
  storehouses: any[];
  audit_trail: any[];
  meetings: any[];
}

const Portal = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("territory");

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Shield className="h-10 w-10 text-sanctuary-bronze animate-pulse" />
          <p className="text-slate-400 text-sm">Loading your Financial Territory…</p>
        </div>
      </div>
    );
  }

  if (error || !data?.contact) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-slate-600 mx-auto" />
          <h1 className="text-xl font-semibold text-slate-200">Access Denied</h1>
          <p className="text-slate-400 text-sm max-w-sm">
            {error || "This portal link is invalid or has expired. Please contact your Personal CFO for a new link."}
          </p>
        </div>
      </div>
    );
  }

  const { contact, vineyard_accounts, storehouses, audit_trail, meetings } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sanctuary-bronze/20">
                <Shield className="h-5 w-5 text-sanctuary-bronze" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-100 font-serif">
                  {contact.first_name} {contact.last_name || ""}
                </h1>
                <p className="text-xs text-slate-500">Sovereign Financial Territory</p>
              </div>
            </div>
            <span className="rounded-full bg-sanctuary-bronze/10 px-3 py-1 text-xs font-medium text-sanctuary-bronze border border-sanctuary-bronze/20">
              {contact.governance_status === "stabilization" ? "Stabilization" : "Sovereign"}
            </span>
          </div>
        </div>
      </header>

      {/* Quick Links */}
      <nav className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            <button
              onClick={() => setActiveTab("meetings")}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" />
              Meetings
              {meetings.length > 0 && (
                <span className="rounded-full bg-sanctuary-bronze/20 px-1.5 text-[10px] font-semibold text-sanctuary-bronze">
                  {meetings.length}
                </span>
              )}
            </button>
            {[
              { href: contact.sidedrawer_url, label: "Documents", icon: FolderOpen },
              { href: contact.asana_url, label: "Tasks", icon: CheckSquare },
              { href: contact.ia_financial_url, label: "Accounts", icon: ShieldCheck },
            ].map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  href
                    ? "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    : "pointer-events-none text-slate-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {href && <ExternalLink className="h-3 w-3 opacity-40" />}
              </a>
            ))}
            <span className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-slate-600 cursor-default">
              <MessageCircle className="h-3.5 w-3.5" />
              Support
              <span className="text-[10px] text-slate-700">(coming soon)</span>
            </span>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-slate-900 border border-slate-800">
            <TabsTrigger value="territory" className="flex-1 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100 text-slate-400">
              <Grape className="mr-1.5 h-4 w-4" />
              Territory
            </TabsTrigger>
            <TabsTrigger value="meetings" className="flex-1 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100 text-slate-400">
              <Calendar className="mr-1.5 h-4 w-4" />
              Meetings
            </TabsTrigger>
            <TabsTrigger value="charter" className="flex-1 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100 text-slate-400">
              <ScrollText className="mr-1.5 h-4 w-4" />
              Charter
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex-1 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100 text-slate-400">
              <Clock className="mr-1.5 h-4 w-4" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="territory" className="mt-6">
            <PortalTerritory
              vineyardAccounts={vineyard_accounts}
              storehouses={storehouses}
              contact={contact}
            />
          </TabsContent>

          <TabsContent value="meetings" className="mt-6">
            <PortalMeetings meetings={meetings} />
          </TabsContent>

          <TabsContent value="charter" className="mt-6">
            <PortalCharter googleDriveUrl={contact.google_drive_url} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <PortalTimeline auditTrail={audit_trail} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 text-center">
          <p className="text-xs text-slate-600">
            ProsperWise Advisors — Your Personal CFO
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Portal;

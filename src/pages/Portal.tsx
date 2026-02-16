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

  const { contact, vineyard_accounts, storehouses, audit_trail, meetings } = data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground font-serif">
                  {contact.first_name} {contact.last_name || ""}
                </h1>
                <p className="text-xs text-muted-foreground">Sovereign Financial Territory</p>
              </div>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent border border-accent/20">
              {contact.governance_status === "stabilization" ? "Stabilization" : "Sovereign"}
            </span>
          </div>
        </div>
      </header>

      {/* Quick Links */}
      <nav className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            <button
              onClick={() => setActiveTab("meetings")}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" />
              Meetings
              {meetings.length > 0 && (
                <span className="rounded-full bg-accent/20 px-1.5 text-[10px] font-semibold text-accent">
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
                    ? "text-foreground/70 hover:bg-muted hover:text-foreground"
                    : "pointer-events-none text-muted-foreground/40"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {href && <ExternalLink className="h-3 w-3 opacity-40" />}
              </a>
            ))}
            <span className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground/40 cursor-default">
              <MessageCircle className="h-3.5 w-3.5" />
              Support
              <span className="text-[10px]">(coming soon)</span>
            </span>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-muted border border-border">
            <TabsTrigger value="territory" className="flex-1">
              <Grape className="mr-1.5 h-4 w-4" />
              Territory
            </TabsTrigger>
            <TabsTrigger value="charter" className="flex-1">
              <ScrollText className="mr-1.5 h-4 w-4" />
              Charter
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex-1">
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
      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 text-center">
          <p className="text-xs text-muted-foreground">
            ProsperWise Advisors — Your Personal CFO
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Portal;

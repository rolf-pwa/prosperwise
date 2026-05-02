import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, MessageSquare, Phone, RefreshCw, Eye, EyeOff, Inbox as InboxIcon } from "lucide-react";
import { toast } from "sonner";

interface QuoMessage {
  id: string;
  contact_id: string | null;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  occurred_at: string;
  portal_visible: boolean;
  pii_blocked: boolean;
  from_number: string | null;
  to_number: string | null;
  read_at: string | null;
}

interface QuoCall {
  id: string;
  contact_id: string | null;
  direction: "inbound" | "outbound";
  duration_seconds: number;
  recording_url: string | null;
  summary: string | null;
  next_steps: string | null;
  occurred_at: string;
  portal_visible: boolean;
  from_number: string | null;
  to_number: string | null;
  read_at: string | null;
}

interface ContactLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

export default function Inbox() {
  const [messages, setMessages] = useState<QuoMessage[]>([]);
  const [calls, setCalls] = useState<QuoCall[]>([]);
  const [contacts, setContacts] = useState<Record<string, ContactLite>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("quo-service", {
        body: { action: "inbox", limit: 200 },
      });
      if (error) throw error;
      setMessages(data?.messages || []);
      setCalls(data?.calls || []);
      setContacts(data?.contacts || {});
    } catch (err: any) {
      toast.error(`Inbox load failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await supabase.functions.invoke("quo-service", { body: { action: "markRead", all: true } });
    } catch {}
  };

  useEffect(() => {
    load().then(() => markAllRead());
    const channel = supabase
      .channel("quo-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "quo_messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "quo_calls" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const togglePortal = async (recordType: "message" | "call", recordId: string, current: boolean) => {
    try {
      const { error } = await supabase.functions.invoke("quo-service", {
        body: { action: "togglePortalVisible", recordType, recordId, visible: !current },
      });
      if (error) throw error;
      toast.success(current ? "Hidden from portal" : "Visible in portal");
      load();
    } catch (err: any) {
      toast.error(`Update failed: ${err.message}`);
    }
  };

  const contactName = (id: string | null, fallback: string | null) => {
    if (id && contacts[id]) {
      const c = contacts[id];
      return `${c.first_name || ""} ${c.last_name || ""}`.trim() || fallback || "Unknown";
    }
    return fallback || "Unknown number";
  };

  const timeline = [
    ...messages.map((m) => ({ kind: "msg" as const, at: m.occurred_at, item: m })),
    ...calls.map((c) => ({ kind: "call" as const, at: c.occurred_at, item: c })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const unreadCount = messages.filter((m) => m.direction === "inbound").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <InboxIcon className="h-7 w-7 text-amber-500" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Inbox</h1>
              <p className="text-sm text-muted-foreground">
                Unified Quo SMS &amp; voice timeline across all contacts
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({timeline.length})</TabsTrigger>
            <TabsTrigger value="sms">SMS ({messages.length})</TabsTrigger>
            <TabsTrigger value="calls">Calls ({calls.length})</TabsTrigger>
            <TabsTrigger value="inbound">Inbound ({unreadCount})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <TimelineList items={timeline} loading={loading} contactName={contactName} onToggle={togglePortal} />
          </TabsContent>
          <TabsContent value="sms" className="mt-4">
            <TimelineList
              items={messages.map((m) => ({ kind: "msg" as const, at: m.occurred_at, item: m }))}
              loading={loading} contactName={contactName} onToggle={togglePortal}
            />
          </TabsContent>
          <TabsContent value="calls" className="mt-4">
            <TimelineList
              items={calls.map((c) => ({ kind: "call" as const, at: c.occurred_at, item: c }))}
              loading={loading} contactName={contactName} onToggle={togglePortal}
            />
          </TabsContent>
          <TabsContent value="inbound" className="mt-4">
            <TimelineList
              items={timeline.filter((e) => (e.item as any).direction === "inbound")}
              loading={loading} contactName={contactName} onToggle={togglePortal}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function TimelineList({
  items, loading, contactName, onToggle,
}: {
  items: Array<{ kind: "msg" | "call"; at: string; item: any }>;
  loading: boolean;
  contactName: (id: string | null, fallback: string | null) => string;
  onToggle: (recordType: "message" | "call", recordId: string, current: boolean) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-12 text-center">No activity yet.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((entry) =>
        entry.kind === "msg" ? (
          <MessageCard key={`m-${entry.item.id}`} m={entry.item} contactName={contactName} onToggle={onToggle} />
        ) : (
          <CallCard key={`c-${entry.item.id}`} c={entry.item} contactName={contactName} onToggle={onToggle} />
        )
      )}
    </div>
  );
}

function MessageCard({
  m, contactName, onToggle,
}: {
  m: QuoMessage;
  contactName: (id: string | null, fallback: string | null) => string;
  onToggle: (recordType: "message" | "call", recordId: string, current: boolean) => void;
}) {
  const isOut = m.direction === "outbound";
  const fallback = isOut ? m.to_number : m.from_number;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium text-foreground">
              {m.contact_id ? (
                <Link to={`/contacts/${m.contact_id}`} className="hover:underline">
                  {contactName(m.contact_id, fallback)}
                </Link>
              ) : contactName(null, fallback)}
            </span>
            <Badge variant={isOut ? "outline" : "default"} className="text-[10px]">
              {isOut ? "Sent" : "Received"}
            </Badge>
            {m.pii_blocked && <Badge variant="destructive" className="text-[10px]">PII BLOCKED</Badge>}
            <span>· {new Date(m.occurred_at).toLocaleString()}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{m.body}</p>
        </div>
        <button
          onClick={() => onToggle("message", m.id, m.portal_visible)}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          title={m.portal_visible ? "Hide from portal" : "Show in portal"}
        >
          {m.portal_visible ? <Eye className="h-4 w-4 text-amber-500" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
    </Card>
  );
}

function CallCard({
  c, contactName, onToggle,
}: {
  c: QuoCall;
  contactName: (id: string | null, fallback: string | null) => string;
  onToggle: (recordType: "message" | "call", recordId: string, current: boolean) => void;
}) {
  const isOut = c.direction === "outbound";
  const fallback = isOut ? c.to_number : c.from_number;
  const mins = Math.floor(c.duration_seconds / 60);
  const secs = c.duration_seconds % 60;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
            <Phone className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium text-foreground">
              {c.contact_id ? (
                <Link to={`/contacts/${c.contact_id}`} className="hover:underline">
                  {contactName(c.contact_id, fallback)}
                </Link>
              ) : contactName(null, fallback)}
            </span>
            <Badge variant={isOut ? "outline" : "default"} className="text-[10px]">
              {isOut ? "Outgoing" : "Incoming"}
            </Badge>
            <span>· {mins}m {secs}s · {new Date(c.occurred_at).toLocaleString()}</span>
          </div>
          {c.summary && <p className="text-sm whitespace-pre-wrap">{c.summary}</p>}
          {c.next_steps && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
              <span className="font-semibold">Next: </span>{c.next_steps}
            </p>
          )}
          {c.recording_url && (
            <a href={c.recording_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-amber-500 hover:underline mt-1.5 inline-block">
              ▶ Listen to recording
            </a>
          )}
        </div>
        <button
          onClick={() => onToggle("call", c.id, c.portal_visible)}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          title={c.portal_visible ? "Hide from portal" : "Show in portal"}
        >
          {c.portal_visible ? <Eye className="h-4 w-4 text-amber-500" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
    </Card>
  );
}

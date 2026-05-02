import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, MessageSquare, Phone, RefreshCw, Eye, EyeOff,
  Inbox as InboxIcon, UserPlus, Link2, Send, AlertCircle,
} from "lucide-react";
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
  email?: string | null;
}

type TimelineEntry =
  | { kind: "msg"; at: string; item: QuoMessage }
  | { kind: "call"; at: string; item: QuoCall };

export default function Inbox() {
  const [messages, setMessages] = useState<QuoMessage[]>([]);
  const [calls, setCalls] = useState<QuoCall[]>([]);
  const [contacts, setContacts] = useState<Record<string, ContactLite>>({});
  const [loading, setLoading] = useState(true);

  // Reply state — keyed by phone number (the counterparty)
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  // Resolve-orphan dialog
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolvePhone, setResolvePhone] = useState<string>("");

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

  const sendReply = async (to: string, contactId: string | null) => {
    if (!replyBody.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("quo-service", {
        body: { action: "sendSms", contactId, to, content: replyBody.trim() },
      });
      if (error) throw error;
      if (data?.blocked) {
        toast.error(`PII Shield blocked: ${data.reason}`, {
          description: "Use the portal or SideDrawer for sensitive details.",
        });
      } else {
        toast.success("Reply sent");
        setReplyBody("");
        setReplyTo(null);
      }
      load();
    } catch (err: any) {
      toast.error(`Send failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const openResolve = (phone: string) => {
    setResolvePhone(phone);
    setResolveOpen(true);
  };

  const contactName = (id: string | null, fallback: string | null) => {
    if (id && contacts[id]) {
      const c = contacts[id];
      return `${c.first_name || ""} ${c.last_name || ""}`.trim() || fallback || "Unknown";
    }
    return fallback || "Unknown number";
  };

  const timeline: TimelineEntry[] = useMemo(() => [
    ...messages.map((m) => ({ kind: "msg" as const, at: m.occurred_at, item: m })),
    ...calls.map((c) => ({ kind: "call" as const, at: c.occurred_at, item: c })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [messages, calls]);

  const unreadCount = messages.filter((m) => m.direction === "inbound" && !m.read_at).length
    + calls.filter((c) => c.direction === "inbound" && !c.read_at).length;

  const unmatchedTimeline = timeline.filter((e) => !e.item.contact_id);

  const cardProps = {
    contactName,
    onToggle: togglePortal,
    onReplyOpen: (phone: string) => { setReplyTo(phone); setReplyBody(""); },
    onResolve: openResolve,
    replyTo, replyBody, setReplyBody, sending,
    sendReply,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <InboxIcon className="h-7 w-7 text-amber-500" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Inbox</h1>
              <p className="text-sm text-muted-foreground">
                Unified SMS &amp; voice timeline across all contacts
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
            <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            <TabsTrigger value="unmatched" className="data-[state=active]:text-amber-500">
              Unmatched ({unmatchedTimeline.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <TimelineList items={timeline} loading={loading} {...cardProps} />
          </TabsContent>
          <TabsContent value="sms" className="mt-4">
            <TimelineList
              items={messages.map((m) => ({ kind: "msg" as const, at: m.occurred_at, item: m }))}
              loading={loading} {...cardProps}
            />
          </TabsContent>
          <TabsContent value="calls" className="mt-4">
            <TimelineList
              items={calls.map((c) => ({ kind: "call" as const, at: c.occurred_at, item: c }))}
              loading={loading} {...cardProps}
            />
          </TabsContent>
          <TabsContent value="unread" className="mt-4">
            <TimelineList
              items={timeline.filter((e) => e.item.direction === "inbound" && !e.item.read_at)}
              loading={loading} {...cardProps}
            />
          </TabsContent>
          <TabsContent value="unmatched" className="mt-4">
            <TimelineList items={unmatchedTimeline} loading={loading} {...cardProps} />
          </TabsContent>
        </Tabs>
      </div>

      <ResolveOrphanDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        phone={resolvePhone}
        onResolved={load}
      />
    </AppLayout>
  );
}

interface CardSharedProps {
  contactName: (id: string | null, fallback: string | null) => string;
  onToggle: (recordType: "message" | "call", recordId: string, current: boolean) => void;
  onReplyOpen: (phone: string) => void;
  onResolve: (phone: string) => void;
  replyTo: string | null;
  replyBody: string;
  setReplyBody: (v: string) => void;
  sending: boolean;
  sendReply: (to: string, contactId: string | null) => void;
}

function TimelineList({
  items, loading, ...rest
}: { items: TimelineEntry[]; loading: boolean } & CardSharedProps) {
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
        entry.kind === "msg"
          ? <MessageCard key={`m-${entry.item.id}`} m={entry.item} {...rest} />
          : <CallCard key={`c-${entry.item.id}`} c={entry.item} {...rest} />
      )}
    </div>
  );
}

function HeaderRow({
  Icon, label, badgeText, badgeVariant, occurredAt, contactId, contactName, fallback, isOrphan,
}: {
  Icon: any; label: string; badgeText: string; badgeVariant: "default" | "outline";
  occurredAt: string; contactId: string | null;
  contactName: (id: string | null, fallback: string | null) => string;
  fallback: string | null; isOrphan: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground flex-wrap">
      <Icon className="h-3.5 w-3.5 text-amber-500" />
      <span className="font-medium text-foreground">
        {contactId ? (
          <Link to={`/contacts/${contactId}`} className="hover:underline">
            {contactName(contactId, fallback)}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            {contactName(null, fallback)}
            {isOrphan && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500">
              <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Unknown sender
            </Badge>}
          </span>
        )}
      </span>
      <Badge variant={badgeVariant} className="text-[10px]">{badgeText}</Badge>
      <span>· {new Date(occurredAt).toLocaleString()}</span>
    </div>
  );
}

function ResolveBar({
  phone, onResolve,
}: { phone: string; onResolve: (phone: string) => void }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
      <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="text-xs text-muted-foreground flex-1">
        This sender ({phone}) isn't in your database yet.
      </span>
      <Button size="sm" variant="outline" onClick={() => onResolve(phone)} className="h-7 text-xs">
        <UserPlus className="h-3 w-3 mr-1" /> Create / Link
      </Button>
    </div>
  );
}

function ReplyBox({
  to, contactId, replyTo, replyBody, setReplyBody, sending, sendReply, onClose,
}: {
  to: string; contactId: string | null;
  replyTo: string | null; replyBody: string; setReplyBody: (v: string) => void;
  sending: boolean; sendReply: (to: string, contactId: string | null) => void;
  onClose: () => void;
}) {
  if (replyTo !== to) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <Textarea
        autoFocus value={replyBody}
        onChange={(e) => setReplyBody(e.target.value)}
        placeholder={`Reply to ${to}…`}
        className="min-h-[70px] text-sm"
      />
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          🛡️ PII Shield: financial figures, account #s, and health terms will be blocked.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button size="sm" onClick={() => sendReply(to, contactId)} disabled={!replyBody.trim() || sending}>
            {sending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageCard({
  m, contactName, onToggle, onReplyOpen, onResolve,
  replyTo, replyBody, setReplyBody, sending, sendReply,
}: { m: QuoMessage } & CardSharedProps) {
  const isOut = m.direction === "outbound";
  const counterparty = isOut ? m.to_number : m.from_number;
  const isOrphan = !m.contact_id && !!counterparty;
  const isUnread = !m.read_at && m.direction === "inbound";

  return (
    <Card className={`p-4 ${isUnread ? "border-l-4 border-l-amber-500 bg-amber-500/5" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <HeaderRow
            Icon={MessageSquare}
            label="msg"
            badgeText={isOut ? "Sent" : "Received"}
            badgeVariant={isOut ? "outline" : "default"}
            occurredAt={m.occurred_at}
            contactId={m.contact_id}
            contactName={contactName}
            fallback={counterparty}
            isOrphan={isOrphan}
          />
          {m.pii_blocked && <Badge variant="destructive" className="text-[10px] mb-1">PII BLOCKED</Badge>}
          <p className="text-sm whitespace-pre-wrap">{m.body}</p>

          {isOrphan && counterparty && <ResolveBar phone={counterparty} onResolve={onResolve} />}

          <div className="mt-2 flex items-center gap-2">
            {counterparty && replyTo !== counterparty && (
              <Button size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => onReplyOpen(counterparty)}>
                <Send className="h-3 w-3 mr-1" /> Reply
              </Button>
            )}
          </div>

          {counterparty && (
            <ReplyBox
              to={counterparty} contactId={m.contact_id}
              replyTo={replyTo} replyBody={replyBody} setReplyBody={setReplyBody}
              sending={sending} sendReply={sendReply}
              onClose={() => onReplyOpen("")}
            />
          )}
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
  c, contactName, onToggle, onReplyOpen, onResolve,
  replyTo, replyBody, setReplyBody, sending, sendReply,
}: { c: QuoCall } & CardSharedProps) {
  const isOut = c.direction === "outbound";
  const counterparty = isOut ? c.to_number : c.from_number;
  const isOrphan = !c.contact_id && !!counterparty;
  const isUnread = !c.read_at && c.direction === "inbound";
  const mins = Math.floor(c.duration_seconds / 60);
  const secs = c.duration_seconds % 60;

  return (
    <Card className={`p-4 ${isUnread ? "border-l-4 border-l-amber-500 bg-amber-500/5" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <HeaderRow
            Icon={Phone}
            label="call"
            badgeText={`${isOut ? "Outgoing" : "Incoming"} · ${mins}m ${secs}s`}
            badgeVariant={isOut ? "outline" : "default"}
            occurredAt={c.occurred_at}
            contactId={c.contact_id}
            contactName={contactName}
            fallback={counterparty}
            isOrphan={isOrphan}
          />
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

          {isOrphan && counterparty && <ResolveBar phone={counterparty} onResolve={onResolve} />}

          <div className="mt-2 flex items-center gap-2">
            {counterparty && replyTo !== counterparty && (
              <Button size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => onReplyOpen(counterparty)}>
                <MessageSquare className="h-3 w-3 mr-1" /> Send SMS
              </Button>
            )}
          </div>
          {counterparty && (
            <ReplyBox
              to={counterparty} contactId={c.contact_id}
              replyTo={replyTo} replyBody={replyBody} setReplyBody={setReplyBody}
              sending={sending} sendReply={sendReply}
              onClose={() => onReplyOpen("")}
            />
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

function ResolveOrphanDialog({
  open, onOpenChange, phone, onResolved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  phone: string; onResolved: () => void;
}) {
  const [mode, setMode] = useState<"create" | "link">("create");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ContactLite[]>([]);

  useEffect(() => {
    if (open) {
      setMode("create");
      setFirstName(""); setLastName(""); setEmail("");
      setSearch(""); setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (mode !== "link" || search.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("quo-service", {
          body: { action: "searchContacts", q: search },
        });
        setResults(data?.contacts || []);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [search, mode]);

  const create = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("quo-service", {
        body: { action: "createContactFromPhone", phone, firstName, lastName, email },
      });
      if (error) throw error;
      toast.success(`Contact created · linked ${data.linkedMessages} messages, ${data.linkedCalls} calls`);
      onOpenChange(false);
      onResolved();
    } catch (err: any) {
      toast.error(`Create failed: ${err.message}`);
    } finally { setBusy(false); }
  };

  const link = async (contactId: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("quo-service", {
        body: { action: "linkPhoneToContact", phone, contactId },
      });
      if (error) throw error;
      toast.success(`Linked ${data.linkedMessages} messages, ${data.linkedCalls} calls`);
      onOpenChange(false);
      onResolved();
    } catch (err: any) {
      toast.error(`Link failed: ${err.message}`);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve {phone}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setMode("create")}
            className={`px-3 py-2 text-sm border-b-2 ${mode === "create" ? "border-amber-500 text-foreground" : "border-transparent text-muted-foreground"}`}>
            <UserPlus className="h-3.5 w-3.5 inline mr-1" /> Create new
          </button>
          <button
            onClick={() => setMode("link")}
            className={`px-3 py-2 text-sm border-b-2 ${mode === "link" ? "border-amber-500 text-foreground" : "border-transparent text-muted-foreground"}`}>
            <Link2 className="h-3.5 w-3.5 inline mr-1" /> Link to existing
          </button>
        </div>

        {mode === "create" ? (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <Input placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Phone <span className="font-mono">{phone}</span> will be saved and all matching SMS/calls back-linked.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={create} disabled={busy || !firstName.trim()}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Create &amp; Link
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <Input
              autoFocus placeholder="Search contacts by name, email or phone…"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {results.length === 0 && search.length >= 2 && (
                <p className="text-xs text-muted-foreground italic p-2">No matches</p>
              )}
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => link(c.id)}
                  disabled={busy}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted text-left text-sm"
                >
                  <span>
                    <span className="font-medium">{c.first_name} {c.last_name}</span>
                    <span className="text-muted-foreground"> · {c.email || c.phone || "—"}</span>
                  </span>
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

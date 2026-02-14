import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, Mail, Plus, Send, Loader2, ExternalLink, Link2Off } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  useGoogleStatus,
  useConnectGoogle,
  useDisconnectGoogle,
  useCalendarEvents,
  useGmailMessages,
  useCreateCalendarEvent,
  useSendGmail,
} from "@/hooks/useGoogle";

export function CommandCenter() {
  const { data: status, isLoading: statusLoading } = useGoogleStatus();
  const connectGoogle = useConnectGoogle();
  const disconnectGoogle = useDisconnectGoogle();
  const isConnected = status?.connected;

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex gap-2">
            <Calendar className="h-8 w-8 text-muted-foreground/40" />
            <Mail className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Command Center</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Google account to view Calendar events and Gmail.
            </p>
          </div>
          <Button
            onClick={() => connectGoogle.mutate()}
            disabled={connectGoogle.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {connectGoogle.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Connect Google Account
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Command Center</h2>
          <Badge className="bg-sanctuary-green/20 text-sanctuary-green border-sanctuary-green/30">
            Connected
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            disconnectGoogle.mutate(undefined, {
              onSuccess: () => toast.success("Google disconnected"),
            });
          }}
          className="text-muted-foreground text-xs"
        >
          <Link2Off className="mr-1 h-3 w-3" />
          Disconnect
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CalendarWidget />
        <GmailWidget />
      </div>
    </div>
  );
}

function CalendarWidget() {
  const { timeMin, timeMax } = useMemo(() => {
    const now = new Date();
    return {
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + 7 * 86400000).toISOString(),
    };
  }, []);
  const { data, isLoading, error } = useCalendarEvents(timeMin, timeMax);
  const createEvent = useCreateCalendarEvent();
  const [showCreate, setShowCreate] = useState(false);
  const [newEvent, setNewEvent] = useState({ summary: "", date: "", startTime: "", endTime: "" });

  const handleCreate = () => {
    if (!newEvent.summary || !newEvent.date || !newEvent.startTime || !newEvent.endTime) {
      toast.error("Please fill all fields");
      return;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    createEvent.mutate(
      {
        summary: newEvent.summary,
        start: { dateTime: `${newEvent.date}T${newEvent.startTime}:00`, timeZone: tz },
        end: { dateTime: `${newEvent.date}T${newEvent.endTime}:00`, timeZone: tz },
      },
      {
        onSuccess: () => {
          toast.success("Event created");
          setShowCreate(false);
          setNewEvent({ summary: "", date: "", startTime: "", endTime: "" });
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-sanctuary-bronze" />
          Upcoming Events
        </CardTitle>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Plus className="mr-1 h-3 w-3" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Calendar Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Event title"
                value={newEvent.summary}
                onChange={(e) => setNewEvent((p) => ({ ...p, summary: e.target.value }))}
              />
              <Input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent((p) => ({ ...p, date: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="time"
                  value={newEvent.startTime}
                  onChange={(e) => setNewEvent((p) => ({ ...p, startTime: e.target.value }))}
                />
                <Input
                  type="time"
                  value={newEvent.endTime}
                  onChange={(e) => setNewEvent((p) => ({ ...p, endTime: e.target.value }))}
                />
              </div>
              <Button onClick={handleCreate} disabled={createEvent.isPending} className="w-full">
                {createEvent.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Event
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load events</p>
        ) : !data?.items?.length ? (
          <p className="text-sm text-muted-foreground">No upcoming events this week.</p>
        ) : (
          <div className="space-y-2">
            {data.items.slice(0, 8).map((event: any) => {
              const start = event.start?.dateTime || event.start?.date;
              const startDate = start ? parseISO(start) : null;
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-md border border-border p-3"
                >
                  <div className="min-w-[3rem] text-center">
                    {startDate && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {format(startDate, "EEE")}
                        </p>
                        <p className="text-sm font-semibold">
                          {format(startDate, "d")}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.summary}</p>
                    {startDate && event.start?.dateTime && (
                      <p className="text-xs text-muted-foreground">
                        {format(startDate, "h:mm a")}
                      </p>
                    )}
                  </div>
                  {event.htmlLink && (
                    <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GmailWidget() {
  const { data, isLoading, error } = useGmailMessages();
  const sendEmail = useSendGmail();
  const [showCompose, setShowCompose] = useState(false);
  const [email, setEmail] = useState({ to: "", subject: "", body: "" });

  const handleSend = () => {
    if (!email.to || !email.subject) {
      toast.error("Please fill To and Subject");
      return;
    }
    sendEmail.mutate(email, {
      onSuccess: () => {
        toast.success("Email sent");
        setShowCompose(false);
        setEmail({ to: "", subject: "", body: "" });
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-sanctuary-bronze" />
          Recent Emails
        </CardTitle>
        <Dialog open={showCompose} onOpenChange={setShowCompose}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Send className="mr-1 h-3 w-3" />
              Compose
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Compose Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="To"
                value={email.to}
                onChange={(e) => setEmail((p) => ({ ...p, to: e.target.value }))}
              />
              <Input
                placeholder="Subject"
                value={email.subject}
                onChange={(e) => setEmail((p) => ({ ...p, subject: e.target.value }))}
              />
              <Textarea
                placeholder="Message..."
                rows={5}
                value={email.body}
                onChange={(e) => setEmail((p) => ({ ...p, body: e.target.value }))}
              />
              <Button onClick={handleSend} disabled={sendEmail.isPending} className="w-full">
                {sendEmail.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send Email
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load emails</p>
        ) : !data?.messages?.length ? (
          <p className="text-sm text-muted-foreground">No recent emails.</p>
        ) : (
          <div className="space-y-2">
            {data.messages.slice(0, 8).map((msg: any) => {
              const fromName = msg.from?.replace(/<.*>/, "").trim() || "Unknown";
              return (
                <div
                  key={msg.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium truncate flex-1">
                      {msg.subject || "(No subject)"}
                    </p>
                    {msg.labelIds?.includes("UNREAD") && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{fromName}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {msg.snippet}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

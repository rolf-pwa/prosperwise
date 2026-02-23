import { useMemo, useState, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, Plus, Send, Loader2, Link2Off, Inbox, ExternalLink } from "lucide-react";
import { format, parseISO, isToday, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useGoogleStatus,
  useConnectGoogle,
  useDisconnectGoogle,
  useCalendarEvents,
  useGmailMessages,
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
    return null;
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
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <AsanaMyTasksWidget />
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


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-sanctuary-bronze" />
          Upcoming Events
        </CardTitle>
        <a href="https://calendar.google.com/calendar/r/eventedit" target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <Plus className="mr-1 h-3 w-3" />
            New
          </Button>
        </a>
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
                 <a
                    key={event.id}
                    href={event.htmlLink || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
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
                 </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GmailWidget() {
  const { data, isLoading, error } = useGmailMessages("is:unread");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-sanctuary-bronze" />
          Recent Emails
        </CardTitle>
        <a href="https://mail.google.com/mail/u/0/#inbox?compose=new" target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <Send className="mr-1 h-3 w-3" />
            Compose
          </Button>
        </a>
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
                 <a
                    key={msg.id}
                    href={`https://mail.google.com/mail/u/0/#all/${msg.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
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
                 </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  due_on: string | null;
  modified_at?: string | null;
  memberships?: { section?: { name?: string }; project?: { gid?: string } }[];
}

function extractProjectGid(asanaUrl: string | null): string | null {
  if (!asanaUrl) return null;
  const match = asanaUrl.match(/app\.asana\.com\/0\/(\d+)/);
  return match ? match[1] : null;
}

function AsanaMyTasksWidget() {
  const [tasks, setTasks] = useState<AsanaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [contactMap, setContactMap] = useState<Record<string, { id: string; name: string }>>({});

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch contacts with Asana URLs to build project GID list
        const contactRes = await supabase
          .from("contacts")
          .select("id, full_name, asana_url")
          .not("asana_url", "is", null);

        const map: Record<string, { id: string; name: string }> = {};
        const projectGids: string[] = [];
        if (contactRes.data) {
          for (const c of contactRes.data) {
            const gid = extractProjectGid(c.asana_url);
            if (gid) {
              map[gid] = { id: c.id, name: c.full_name };
              projectGids.push(gid);
            }
          }
        }
        setContactMap(map);

        // Fetch tasks assigned to me, filtered to known projects
        const taskRes = await supabase.functions.invoke("asana-service", {
          body: { action: "getMyTasks", project_gids: projectGids.length > 0 ? projectGids : undefined },
        });

        if (taskRes.data?.data) {
          setTasks(taskRes.data.data as AsanaTask[]);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function getLinkedContact(task: AsanaTask) {
    for (const m of task.memberships || []) {
      const gid = m.project?.gid;
      if (gid && contactMap[gid]) return contactMap[gid];
    }
    return null;
  }

  function getSectionLabel(task: AsanaTask): string | null {
    const section = task.memberships?.[0]?.section?.name;
    return section || null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-4 w-4 text-sanctuary-bronze" />
          My Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load tasks</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks assigned to you.</p>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 12).map((task) => {
              const linked = getLinkedContact(task);
              const section = getSectionLabel(task);
              return (
                <a
                  key={task.gid}
                  href={`https://app.asana.com/0/0/${task.gid}/f`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{task.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {linked && (
                        <span className="text-xs text-accent font-medium truncate">{linked.name}</span>
                      )}
                      {task.due_on && (
                        <span className="text-xs text-muted-foreground">
                          Due: {format(new Date(task.due_on), "MMM d")}
                        </span>
                      )}
                      {task.modified_at && (
                        <span className="text-xs text-muted-foreground">
                          · {formatDistanceToNow(new Date(task.modified_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  {section && (
                    <Badge variant="outline" className="text-[10px] shrink-0 whitespace-nowrap">
                      {section}
                    </Badge>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

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
    return (
      <Card className="border-dashed border-border">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex gap-3 text-muted-foreground/30">
            <Calendar className="h-8 w-8" />
            <Mail className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Connect Google Workspace</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Link your Google account to view Calendar events, Gmail, and enable task automation.
            </p>
          </div>
          <Button
            onClick={() => connectGoogle.mutate()}
            disabled={connectGoogle.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
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
  // Match /0/[id], /project/[id], /0/[id]/[task_id], /project/[id]/list/[task_id]
  const match = asanaUrl.match(/app\.asana\.com\/(?:0|project)\/(\d+)/);
  return match ? match[1] : null;
}

function extractTaskGid(asanaUrl: string | null): string | null {
  if (!asanaUrl) return null;
  // Match /task/[id] or /0/[proj]/[task_id] (second segment)
  const taskMatch = asanaUrl.match(/\/task\/(\d+)/);
  if (taskMatch) return taskMatch[1];
  const twoSegment = asanaUrl.match(/app\.asana\.com\/0\/\d+\/(\d+)/);
  return twoSegment ? twoSegment[1] : null;
}

function AsanaMyTasksWidget() {
  const [tasks, setTasks] = useState<AsanaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [contactMap, setContactMap] = useState<Record<string, { id: string; name: string }>>({});
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const contactRes = await supabase
          .from("contacts")
          .select("id, full_name, asana_url")
          .not("asana_url", "is", null);

        const map: Record<string, { id: string; name: string }> = {};
        const projectGids: string[] = [];
        if (contactRes.data) {
          for (const c of contactRes.data) {
            const projGid = extractProjectGid(c.asana_url);
            if (projGid) {
              map[projGid] = { id: c.id, name: c.full_name };
              projectGids.push(projGid);
            }
            const taskGid = extractTaskGid(c.asana_url);
            if (taskGid) {
              map[taskGid] = { id: c.id, name: c.full_name };
            }
          }
        }
        setContactMap(map);

        const taskRes = await supabase.functions.invoke("asana-service", {
          body: { action: "getMyTasks", project_gids: projectGids.length > 0 ? projectGids : undefined },
        });

        if (taskRes.data?.data) {
          const sorted = (taskRes.data.data as AsanaTask[]).sort((a, b) => {
            if (!a.due_on && !b.due_on) return 0;
            if (!a.due_on) return 1;
            if (!b.due_on) return -1;
            return new Date(a.due_on).getTime() - new Date(b.due_on).getTime();
          });
          setTasks(sorted);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function getLinkedContact(task: AsanaTask) {
    // Check project memberships
    for (const m of task.memberships || []) {
      const gid = m.project?.gid;
      if (gid && contactMap[gid]) return contactMap[gid];
    }
    // Check if the task GID itself is a linked parent task
    if (contactMap[task.gid]) return contactMap[task.gid];
    return null;
  }

  function getSectionLabel(task: AsanaTask): string | null {
    const section = task.memberships?.[0]?.section?.name;
    return section || null;
  }

  const handleTaskClick = (task: AsanaTask) => {
    const linked = getLinkedContact(task);
    if (linked) {
      navigate(`/contacts/${linked.id}`);
    } else {
      // No linked contact — fall back to opening in Asana
      window.open(`https://app.asana.com/0/0/${task.gid}/f`, "_blank");
    }
  };

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
                <button
                  key={task.gid}
                  onClick={() => handleTaskClick(task)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/50 text-left"
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
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

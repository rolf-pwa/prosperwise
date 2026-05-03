import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Calendar, Pin, Loader2 } from "lucide-react";
import { format, parseISO, isToday, differenceInCalendarDays } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";
import { supabase } from "@/integrations/supabase/client";
import { useCalendarEvents, useGoogleStatus } from "@/hooks/useGoogle";

// Pinned Asana project shown in the third dashboard widget.
// Update PINNED_PROJECT_GID with the GID from the Asana project URL:
// https://app.asana.com/0/{PROJECT_GID}/list
const PINNED_PROJECT_GID = "1214066166978534";
const PINNED_PROJECT_LABEL = "Pinned Project";

function TodayTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const res = await supabase.functions.invoke("asana-service", {
          body: { action: "getMyTasks" },
        });
        const all = res.data?.data || [];
        const todays = all.filter(
          (t: any) =>
            !t.completed &&
            t.due_on &&
            isToday(parseLocalDate(t.due_on))
        );
        setTasks(todays);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CheckSquare className="h-4 w-4" />
          Today's Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due today.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.slice(0, 6).map((t) => (
              <li key={t.gid}>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-my-task", { detail: { gid: t.gid } })
                    );
                  }}
                  className="flex w-full items-start gap-2 text-sm text-foreground rounded-md px-1 py-0.5 -mx-1 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sanctuary-bronze shrink-0" />
                  <span className="truncate">{t.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TodayEvents() {
  const { data: status } = useGoogleStatus();
  const { timeMin, timeMax } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }, []);
  const { data, isLoading } = useCalendarEvents(timeMin, timeMax);

  const events = (data?.items || []).filter((e: any) => e.start?.dateTime || e.start?.date);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Calendar className="h-4 w-4" />
          Today's Events
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!status?.connected ? (
          <p className="text-sm text-muted-foreground">Connect Google to view events.</p>
        ) : isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events today.</p>
        ) : (
          <ul className="space-y-2">
            {events.slice(0, 6).map((e: any) => {
              const start = e.start?.dateTime || e.start?.date;
              const startDate = start ? parseISO(start) : null;
              return (
                <li key={e.id}>
                  <a
                    href={e.htmlLink || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 text-sm rounded-md px-1 py-0.5 -mx-1 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground w-14 shrink-0 mt-0.5">
                      {startDate && e.start?.dateTime
                        ? format(startDate, "h:mm a")
                        : "All day"}
                    </span>
                    <span className="truncate text-foreground">{e.summary}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PinnedProjectTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!PINNED_PROJECT_GID) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await supabase.functions.invoke("asana-service", {
          body: { action: "getTasksForProject", project_gid: PINNED_PROJECT_GID },
        });
        const all = res.data?.data || res.data || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = (Array.isArray(all) ? all : [])
          .filter((t: any) => !t.completed && t.due_on)
          .map((t: any) => ({ ...t, _due: parseLocalDate(t.due_on) }))
          .filter((t: any) => {
            const diff = differenceInCalendarDays(t._due, today);
            return diff >= 0 && diff <= 7;
          })
          .sort((a: any, b: any) => a._due.getTime() - b._due.getTime());
        setTasks(upcoming);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Pin className="h-4 w-4" />
          {PINNED_PROJECT_LABEL} — Next 7 Days
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!PINNED_PROJECT_GID ? (
          <p className="text-sm text-muted-foreground">
            Set <code>PINNED_PROJECT_GID</code> in <code>TodayActivities.tsx</code>.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due in the next 7 days.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.slice(0, 6).map((t) => (
              <li key={t.gid}>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-my-task", { detail: { gid: t.gid } })
                    );
                  }}
                  className="flex w-full items-start gap-2 text-sm rounded-md px-1 py-0.5 -mx-1 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-xs text-muted-foreground w-14 shrink-0 mt-0.5">
                    {format(t._due, "MMM d")}
                  </span>
                  <span className="truncate text-foreground">{t.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function TodayActivities() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Today</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TodayTasks />
        <TodayEvents />
        <PinnedProjectTasks />
      </div>
    </div>
  );
}

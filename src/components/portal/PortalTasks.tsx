import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckSquare, Clock, AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PortalTaskConversation } from "./PortalTaskConversation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  due_on: string | null;
  notes: string;
  memberships?: { section?: { name?: string } }[];
}

interface Props {
  portalToken: string;
}

function getTaskStatus(task: AsanaTask): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  if (task.completed) return { label: "Completed", variant: "secondary" };
  const sectionName = task.memberships?.[0]?.section?.name?.toLowerCase() || "";
  if (sectionName.includes("review") || sectionName.includes("awaiting"))
    return { label: "Awaiting Review", variant: "outline" };
  if (sectionName.includes("progress") || sectionName.includes("doing"))
    return { label: "In Progress", variant: "default" };
  if (task.due_on && new Date(task.due_on) < new Date())
    return { label: "Overdue", variant: "destructive" };
  return { label: "Open", variant: "outline" };
}

export function PortalTasks({ portalToken }: Props) {
  const [tasks, setTasks] = useState<AsanaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<AsanaTask | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await supabase.functions.invoke("asana-service", {
          body: { action: "getTasksForProject", portal_token: portalToken },
        });
        if (res.error) throw res.error;
        if (res.data?.error) {
          setError(res.data.error);
        } else {
          setTasks(res.data?.data || []);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load tasks");
      } finally {
        setLoading(false);
      }
    })();
  }, [portalToken]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="h-8 w-8 text-accent animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Loading your action items…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold text-foreground font-serif">Unable to Load Tasks</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">{error}</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold text-foreground font-serif">All Clear</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          No immediate actions require your attention at this time.
        </p>
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold text-foreground font-serif">Immediate Actions</h2>
        {activeTasks.length > 0 && (
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
            {activeTasks.length}
          </span>
        )}
      </div>

      {/* Active Tasks */}
      <div className="space-y-2">
        {activeTasks.map((task) => {
          const status = getTaskStatus(task);
          return (
            <button
              key={task.gid}
              onClick={() => setSelectedTask(task)}
              className="w-full flex items-center justify-between gap-3 rounded-lg bg-card border border-border p-4 hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 border border-accent/20">
                  <Clock className="h-4 w-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
                  {task.due_on && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due: {new Date(task.due_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={status.variant} className="text-[10px] whitespace-nowrap">
                  {status.label}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">
            Completed ({completedTasks.length})
          </p>
          {completedTasks.slice(0, 5).map((task) => (
            <button
              key={task.gid}
              onClick={() => setSelectedTask(task)}
              className="w-full flex items-center justify-between gap-3 rounded-lg bg-card/50 border border-border/50 p-3 hover:bg-muted/30 transition-colors text-left group opacity-60"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CheckSquare className="h-4 w-4 text-accent/50 shrink-0" />
                <p className="text-sm text-muted-foreground truncate line-through">{task.name}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Conversation Sheet */}
      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-base font-serif text-foreground truncate pr-8">
                Task Governance
              </SheetTitle>
              {selectedTask && (
                <Badge variant={getTaskStatus(selectedTask).variant} className="text-[10px] shrink-0">
                  {getTaskStatus(selectedTask).label}
                </Badge>
              )}
            </div>
            {selectedTask && (
              <p className="text-sm text-muted-foreground truncate">{selectedTask.name}</p>
            )}
          </SheetHeader>
          {selectedTask && (
            <PortalTaskConversation
              taskGid={selectedTask.gid}
              portalToken={portalToken}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

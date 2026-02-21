import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckSquare,
  Clock,
  Loader2,
  AlertCircle,
  Sparkles,
  RotateCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  due_on: string | null;
  notes: string;
  memberships?: { section?: { name?: string } }[];
  custom_fields?: any[];
}

interface Props {
  asanaUrl: string | null;
}

type TaskCategory = "new" | "ongoing";

function getTaskStatus(task: AsanaTask): {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
} {
  if (task.completed) return { label: "Done", variant: "secondary" };
  const section =
    task.memberships?.[0]?.section?.name?.toLowerCase() || "";
  if (section.includes("review") || section.includes("awaiting"))
    return { label: "Awaiting Review", variant: "outline" };
  if (section.includes("progress") || section.includes("doing"))
    return { label: "In Progress", variant: "default" };
  if (task.due_on && new Date(task.due_on) < new Date())
    return { label: "Overdue", variant: "destructive" };
  return { label: "Open", variant: "outline" };
}

function categorise(task: AsanaTask): TaskCategory {
  const section =
    task.memberships?.[0]?.section?.name?.toLowerCase() || "";
  if (
    section.includes("progress") ||
    section.includes("doing") ||
    section.includes("review") ||
    section.includes("awaiting") ||
    section.includes("ongoing")
  )
    return "ongoing";
  return "new";
}

function extractProjectGid(url: string | null): string | null {
  if (!url) return null;
  const newMatch = url.match(/\/project\/(\d+)/);
  if (newMatch) return newMatch[1];
  const oldMatch = url.match(/app\.asana\.com\/0\/(\d+)/);
  return oldMatch ? oldMatch[1] : null;
}

function getVisibility(task: AsanaTask): string | null {
  const cf = task.custom_fields?.find(
    (f: any) => f.name === "PW_Visibility" || f.name?.toLowerCase().includes("visibility"),
  );
  return cf?.enum_value?.name || null;
}

export function ContactTaskList({ asanaUrl }: Props) {
  const [tasks, setTasks] = useState<AsanaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  const projectGid = extractProjectGid(asanaUrl);

  useEffect(() => {
    if (!projectGid) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await supabase.functions.invoke("asana-service", {
          body: { action: "getTasksForProject", project_gid: projectGid },
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
  }, [projectGid]);

  if (!asanaUrl || !projectGid) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No Asana project linked.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 text-accent animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const active = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);
  const newTasks = active.filter((t) => categorise(t) === "new");
  const ongoingTasks = active.filter((t) => categorise(t) === "ongoing");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            Tasks
          </CardTitle>
          {active.length > 0 && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
              {active.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {active.length === 0 && completed.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">No tasks found.</p>
        )}

        {/* New Tasks */}
        {newTasks.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              <Sparkles className="h-3 w-3" />
              New ({newTasks.length})
            </div>
            {newTasks.map((task) => (
              <TaskRow key={task.gid} task={task} />
            ))}
          </div>
        )}

        {/* Ongoing Tasks */}
        {ongoingTasks.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              <RotateCw className="h-3 w-3" />
              Ongoing ({ongoingTasks.length})
            </div>
            {ongoingTasks.map((task) => (
              <TaskRow key={task.gid} task={task} />
            ))}
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider w-full hover:text-foreground transition-colors">
              {completedOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Completed ({completed.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 mt-1.5">
              {completed.slice(0, 10).map((task) => (
                <TaskRow key={task.gid} task={task} completed />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Link to Asana */}
        <a
          href={asanaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
        >
          Open in Asana
          <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, completed }: { task: AsanaTask; completed?: boolean }) {
  const status = getTaskStatus(task);
  const visibility = getVisibility(task);

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
        completed ? "opacity-50" : "bg-muted/50 hover:bg-muted"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium truncate ${completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.name}
        </p>
        {task.due_on && !completed && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Due {new Date(task.due_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {visibility && (
          <Badge
            variant={visibility === "Client Visible" ? "default" : "secondary"}
            className="text-[9px] px-1.5 py-0"
          >
            {visibility === "Client Visible" ? "Client" : "Internal"}
          </Badge>
        )}
        <Badge variant={status.variant} className="text-[9px] px-1.5 py-0">
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

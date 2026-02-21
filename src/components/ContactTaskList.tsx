import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckSquare,
  Loader2,
  AlertCircle,
  Sparkles,
  RotateCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Send,
  Save,
  X,
  Calendar,
  FileText,
  Pencil,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  due_on: string | null;
  notes: string;
  assignee?: { gid: string; name: string } | null;
  memberships?: { section?: { name?: string } }[];
  custom_fields?: any[];
}

interface AsanaMember {
  gid: string;
  name: string;
  email?: string;
}

interface AsanaComment {
  gid: string;
  text: string;
  created_at: string;
  created_by?: { name?: string };
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
  const section = task.memberships?.[0]?.section?.name?.toLowerCase() || "";
  if (section.includes("review") || section.includes("awaiting"))
    return { label: "Awaiting Review", variant: "outline" };
  if (section.includes("progress") || section.includes("doing"))
    return { label: "In Progress", variant: "default" };
  if (task.due_on && new Date(task.due_on) < new Date())
    return { label: "Overdue", variant: "destructive" };
  return { label: "Open", variant: "outline" };
}

function categorise(task: AsanaTask): TaskCategory {
  const section = task.memberships?.[0]?.section?.name?.toLowerCase() || "";
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
    (f: any) =>
      f.name === "PW_Visibility" ||
      f.name?.toLowerCase().includes("visibility"),
  );
  return cf?.enum_value?.name || null;
}

export function ContactTaskList({ asanaUrl }: Props) {
  const [tasks, setTasks] = useState<AsanaTask[]>([]);
  const [members, setMembers] = useState<AsanaMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<AsanaTask | null>(null);

  const projectGid = extractProjectGid(asanaUrl);

  const fetchTasks = useCallback(async () => {
    if (!projectGid) {
      setLoading(false);
      return;
    }
    try {
      const [tasksRes, membersRes] = await Promise.all([
        supabase.functions.invoke("asana-service", {
          body: { action: "getTasksForProject", project_gid: projectGid },
        }),
        supabase.functions.invoke("asana-service", {
          body: { action: "getProjectMembers", project_gid: projectGid },
        }),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (tasksRes.data?.error) {
        setError(tasksRes.data.error);
      } else {
        setTasks(tasksRes.data?.data || []);
      }
      if (!membersRes.error && !membersRes.data?.error) {
        setMembers(membersRes.data?.data || []);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [projectGid]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleTaskUpdated = (updatedTask: AsanaTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.gid === updatedTask.gid ? { ...t, ...updatedTask } : t)),
    );
    setSelectedTask((prev) =>
      prev?.gid === updatedTask.gid ? { ...prev, ...updatedTask } : prev,
    );
  };

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
    <>
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
            <p className="text-sm text-muted-foreground text-center py-2">
              No tasks found.
            </p>
          )}

          {newTasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                <Sparkles className="h-3 w-3" />
                New ({newTasks.length})
              </div>
              {newTasks.map((task) => (
                <TaskRow
                  key={task.gid}
                  task={task}
                  onClick={() => setSelectedTask(task)}
                />
              ))}
            </div>
          )}

          {ongoingTasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                <RotateCw className="h-3 w-3" />
                Ongoing ({ongoingTasks.length})
              </div>
              {ongoingTasks.map((task) => (
                <TaskRow
                  key={task.gid}
                  task={task}
                  onClick={() => setSelectedTask(task)}
                />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider w-full hover:text-foreground transition-colors">
                {completedOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Completed ({completed.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1.5 mt-1.5">
                {completed.slice(0, 10).map((task) => (
                  <TaskRow
                    key={task.gid}
                    task={task}
                    completed
                    onClick={() => setSelectedTask(task)}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

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

      {/* Task Detail Sheet */}
      <Sheet
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedTask && (
            <TaskDetailPanel
              task={selectedTask}
              members={members}
              onUpdated={handleTaskUpdated}
              onClose={() => setSelectedTask(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ── Task Row ── */
function TaskRow({
  task,
  completed,
  onClick,
}: {
  task: AsanaTask;
  completed?: boolean;
  onClick: () => void;
}) {
  const status = getTaskStatus(task);
  const visibility = getVisibility(task);

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors w-full text-left ${
        completed ? "opacity-50" : "bg-muted/50 hover:bg-muted"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium truncate ${completed ? "line-through text-muted-foreground" : "text-foreground"}`}
        >
          {task.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {task.assignee?.name && (
            <span className="text-[10px] text-muted-foreground">{task.assignee.name}</span>
          )}
          {task.assignee?.name && task.due_on && !completed && (
            <span className="text-[10px] text-muted-foreground">·</span>
          )}
          {task.due_on && !completed && (
            <span className="text-[10px] text-muted-foreground">
              Due{" "}
              {new Date(task.due_on).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
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
    </button>
  );
}

/* ── Task Detail Panel (inside Sheet) ── */
function TaskDetailPanel({
  task,
  members,
  onUpdated,
  onClose,
}: {
  task: AsanaTask;
  members: AsanaMember[];
  onUpdated: (t: AsanaTask) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(task.name);
  const [editNotes, setEditNotes] = useState(task.notes || "");
  const [editDueOn, setEditDueOn] = useState(task.due_on || "");
  const [editAssignee, setEditAssignee] = useState(task.assignee?.gid || "");
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState<AsanaComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  // Reset edit state when task changes
  useEffect(() => {
    setEditName(task.name);
    setEditNotes(task.notes || "");
    setEditDueOn(task.due_on || "");
    setEditAssignee(task.assignee?.gid || "");
    setEditing(false);
  }, [task.gid, task.name, task.notes, task.due_on, task.assignee?.gid]);

  // Fetch comments
  useEffect(() => {
    (async () => {
      setCommentsLoading(true);
      try {
        const res = await supabase.functions.invoke("asana-service", {
          body: { action: "getTaskStories", task_gid: task.gid },
        });
        if (!res.error && !res.data?.error) {
          setComments(res.data?.data || []);
        }
      } catch {
        // silent
      } finally {
        setCommentsLoading(false);
      }
    })();
  }, [task.gid]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {};
      if (editName !== task.name) updates.name = editName;
      if (editNotes !== (task.notes || "")) updates.notes = editNotes;
      if (editDueOn !== (task.due_on || ""))
        updates.due_on = editDueOn || null;
      if (editAssignee !== (task.assignee?.gid || ""))
        updates.assignee = editAssignee || null;

      if (Object.keys(updates).length === 0) {
        setEditing(false);
        setSaving(false);
        return;
      }

      const res = await supabase.functions.invoke("asana-service", {
        body: { action: "updateTask", task_gid: task.gid, updates },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);

      const assigneeMember = members.find((m) => m.gid === editAssignee);
      onUpdated({
        ...task,
        ...updates,
        assignee: assigneeMember ? { gid: assigneeMember.gid, name: assigneeMember.name } : updates.assignee === null ? null : task.assignee,
      });
      toast.success("Task updated.");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to update task.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async () => {
    setSaving(true);
    try {
      const newCompleted = !task.completed;
      const res = await supabase.functions.invoke("asana-service", {
        body: {
          action: "updateTask",
          task_gid: task.gid,
          updates: { completed: newCompleted },
        },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);

      onUpdated({ ...task, completed: newCompleted });
      toast.success(newCompleted ? "Task completed." : "Task reopened.");
    } catch (e: any) {
      toast.error(e.message || "Failed to update task.");
    } finally {
      setSaving(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const res = await supabase.functions.invoke("asana-service", {
        body: {
          action: "postTaskComment",
          task_gid: task.gid,
          text: newComment.trim(),
        },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);

      // Add optimistically
      setComments((prev) => [
        ...prev,
        {
          gid: Date.now().toString(),
          text: newComment.trim(),
          created_at: new Date().toISOString(),
          created_by: { name: "You" },
        },
      ]);
      setNewComment("");
      toast.success("Comment posted.");
    } catch (e: any) {
      toast.error(e.message || "Failed to post comment.");
    } finally {
      setPosting(false);
    }
  };

  const status = getTaskStatus(task);

  return (
    <div className="space-y-6 pt-2">
      <SheetHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <Badge variant={status.variant} className="text-xs">
            {status.label}
          </Badge>
          <div className="flex items-center gap-1">
            {!editing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        {editing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="text-lg font-semibold"
          />
        ) : (
          <SheetTitle className="text-lg leading-tight">
            {task.name}
          </SheetTitle>
        )}
      </SheetHeader>

      {/* Meta rows */}
      <div className="space-y-3 text-sm">
        {/* Due date */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {editing ? (
            <Input
              type="date"
              value={editDueOn}
              onChange={(e) => setEditDueOn(e.target.value)}
              className="h-7 w-36 text-xs"
            />
          ) : (
            <span>
              {task.due_on
                ? new Date(task.due_on).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "No due date"}
            </span>
          )}
        </div>

        {/* Assignee */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {editing ? (
            <select
              value={editAssignee}
              onChange={(e) => setEditAssignee(e.target.value)}
              className="h-7 rounded-md border bg-background px-2 text-xs text-foreground"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.gid} value={m.gid}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <span>{task.assignee?.name || "Unassigned"}</span>
          )}
        </div>

        <Button
          variant={task.completed ? "secondary" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={handleToggleComplete}
          disabled={saving}
        >
          {task.completed ? "Reopen" : "Mark Complete"}
        </Button>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          <FileText className="h-3 w-3" />
          Notes
        </div>
        {editing ? (
          <Textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={5}
            placeholder="Add notes..."
            className="text-sm"
          />
        ) : (
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap min-h-[60px]">
            {task.notes || (
              <span className="text-muted-foreground italic">No notes</span>
            )}
          </div>
        )}
      </div>

      {/* Edit actions */}
      {editing && (
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditName(task.name);
              setEditNotes(task.notes || "");
              setEditDueOn(task.due_on || "");
              setEditAssignee(task.assignee?.gid || "");
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <Separator />

      {/* Comments */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          <MessageSquare className="h-3 w-3" />
          Comments ({comments.length})
        </div>

        {commentsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">
            No comments yet.
          </p>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {comments.map((comment) => (
              <div
                key={comment.gid}
                className="rounded-md bg-muted/50 px-3 py-2 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    {comment.created_by?.name || "Unknown"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Post comment */}
        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            rows={2}
            className="text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handlePostComment();
              }
            }}
          />
          <Button
            size="icon"
            className="shrink-0 self-end h-9 w-9"
            onClick={handlePostComment}
            disabled={posting || !newComment.trim()}
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Press ⌘+Enter to send
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2, MessageCircle, CheckCircle2, Circle, ListChecks, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { parseLocalDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface Story {
  gid: string;
  text: string;
  created_by: { name: string };
  created_at: string;
}

interface Subtask {
  gid: string;
  name: string;
  completed: boolean;
  due_on: string | null;
}

interface Props {
  taskGid: string;
  portalToken: string;
  clientName?: string;
  readOnly?: boolean;
}

export function PortalTaskConversation({ taskGid, portalToken, clientName, readOnly }: Props) {
  const [stories, setStories] = useState<Story[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const [storiesRes, subtasksRes] = await Promise.all([
        supabase.functions.invoke("asana-service", {
          body: { action: "getTaskStories", task_gid: taskGid, portal_token: portalToken },
        }),
        supabase.functions.invoke("asana-service", {
          body: { action: "getSubtasks", task_gid: taskGid, portal_token: portalToken },
        }),
      ]);
      if (storiesRes.data?.data) {
        setStories(storiesRes.data.data);
      }
      if (subtasksRes.data?.data) {
        setSubtasks(subtasksRes.data.data);
      }
    } catch (e) {
      console.error("Failed to load task data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setStories([]);
    setSubtasks([]);
    fetchData();
  }, [taskGid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [stories]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text || sending) return;
    if (text.length > 5000) {
      toast({ title: "Message too long", description: "Please keep your message under 5,000 characters.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const res = await supabase.functions.invoke("asana-service", {
        body: { action: "postTaskComment", task_gid: taskGid, text, portal_token: portalToken },
      });
      if (res.data?.error) {
        toast({ title: "Error", description: res.data.error, variant: "destructive" });
      } else {
        setMessage("");
        await fetchData();
      }
    } catch {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Subtasks */}
      {subtasks.length > 0 && (
        <div className="px-4 pt-3 pb-2 border-b border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Subtasks ({subtasks.filter(s => s.completed).length}/{subtasks.length})
            </span>
          </div>
          <ul className="space-y-1.5">
            {subtasks.map((st) => (
              <li key={st.gid} className="flex items-center gap-2 text-sm">
                {st.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <span className={st.completed ? "line-through text-muted-foreground" : "text-foreground"}>
                  {st.name}
                </span>
                {st.due_on && !st.completed && (
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                    {parseLocalDate(st.due_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No messages yet. Start the conversation below.
            </p>
          </div>
        ) : (
        stories.map((story) => {
            const prefixMatch = story.text.match(/^\[(.+?)\]:\s/);
            const isClient = !!prefixMatch;
            const displayName = isClient ? prefixMatch![1] : (story.created_by?.name || "Unknown");
            const displayText = isClient ? story.text.replace(/^\[.+?\]:\s/, "") : story.text;
            return (
              <div key={story.gid} className="flex flex-col gap-1">
                <div className={`flex items-center gap-2 ${isClient ? 'justify-end' : ''}`}>
                  <span className="text-xs font-semibold text-foreground">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(story.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className={`rounded-lg px-4 py-3 text-sm leading-relaxed max-w-[90%] whitespace-pre-wrap break-words ${
                  isClient
                    ? 'bg-[hsl(38_40%_92%)] border border-[hsl(38_30%_78%)] text-foreground ml-auto'
                    : 'bg-muted border border-border text-foreground'
                }`}>
                  {displayText.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                    /^https?:\/\//.test(part) ? (
                      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80 underline break-all">
                        {part}
                      </a>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input */}
      {readOnly ? (
        <div className="border-t border-border px-4 py-3 bg-muted/50">
          <p className="text-xs text-muted-foreground text-center">This task is completed. Comments are closed.</p>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-3 bg-background">
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Send a message…"
              className="min-h-[44px] max-h-[120px] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              size="icon"
              className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground h-[44px] w-[44px]"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

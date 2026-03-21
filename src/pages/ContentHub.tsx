import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, Loader2, PenLine, Calendar as CalendarIcon,
  Linkedin, BookText, Globe, Trash2, Eye, Clock,
  CheckCircle2, FileEdit, Archive, Filter,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ContentPost = {
  id: string;
  title: string;
  body: string;
  status: string;
  created_by: string;
  assigned_to: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PlatformVersion = {
  id: string;
  post_id: string;
  platform: string;
  title: string;
  body: string;
  published: boolean;
  published_at: string | null;
  external_url: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  draft: { label: "Draft", icon: FileEdit, color: "text-muted-foreground" },
  review: { label: "In Review", icon: Eye, color: "text-amber-600" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-emerald-600" },
  published: { label: "Published", icon: CheckCircle2, color: "text-primary" },
  archived: { label: "Archived", icon: Archive, color: "text-muted-foreground" },
};

const PLATFORM_ICONS: Record<string, any> = {
  linkedin: Linkedin,
  substack: BookText,
  wix_blog: Globe,
};

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  substack: "Substack",
  wix_blog: "Wix Blog",
};

const ContentHub = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [versions, setVersions] = useState<PlatformVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    const [postsRes, versionsRes] = await Promise.all([
      supabase.from("content_posts" as any).select("*").order("updated_at", { ascending: false }),
      supabase.from("content_platform_versions" as any).select("*"),
    ]);
    setPosts((postsRes.data as any[]) || []);
    setVersions((versionsRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await (supabase.from("content_posts" as any) as any)
        .insert({ title: "Untitled Post", body: "", created_by: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      navigate(`/content-hub/${(data as any).id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await (supabase.from("content_posts" as any) as any).delete().eq("id", id);
    fetchData();
    toast.success("Post deleted");
  };

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [posts, statusFilter, search]);

  const getVersionsForPost = (postId: string) => versions.filter((v) => v.post_id === postId);

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const scheduledPosts = useMemo(() => {
    return posts.filter((p) => p.scheduled_at);
  }, [posts]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Content Hub</h1>
            <p className="text-sm text-muted-foreground mt-1">Create, repurpose, and manage content for LinkedIn, Substack, and Wix Blog</p>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            New Post
          </Button>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <div className="flex items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="list" className="gap-2"><PenLine className="h-4 w-4" />Posts</TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2"><CalendarIcon className="h-4 w-4" />Calendar</TabsTrigger>
            </TabsList>
            {view === "list" && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search posts…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-56 h-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-9">
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="review">In Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <TabsContent value="list" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <PenLine className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No content posts yet. Create your first one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((post) => {
                  const cfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft;
                  const pvs = getVersionsForPost(post.id);
                  return (
                    <Card
                      key={post.id}
                      className="cursor-pointer hover:border-primary/30 transition-colors"
                      onClick={() => navigate(`/content-hub/${post.id}`)}
                    >
                      <CardContent className="py-3 px-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm truncate">{post.title}</h3>
                            <Badge variant="outline" className={cn("text-[10px] gap-1 shrink-0", cfg.color)}>
                              <cfg.icon className="h-2.5 w-2.5" />
                              {cfg.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              Updated {format(new Date(post.updated_at), "MMM d, yyyy")}
                            </span>
                            {post.scheduled_at && (
                              <span className="text-xs text-amber-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(post.scheduled_at), "MMM d 'at' h:mm a")}
                              </span>
                            )}
                            {pvs.length > 0 && (
                              <div className="flex items-center gap-1">
                                {pvs.map((v) => {
                                  const PIcon = PLATFORM_ICONS[v.platform];
                                  return (
                                    <Badge key={v.id} variant={v.published ? "default" : "outline"} className="text-[9px] gap-0.5 px-1.5 py-0">
                                      {PIcon && <PIcon className="h-2.5 w-2.5" />}
                                      {PLATFORM_LABELS[v.platform]}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => handleDelete(post.id, e)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Button variant="ghost" size="sm" onClick={() => setCalendarMonth((m) => subMonths(m, 1))}>←</Button>
                <CardTitle className="text-base">{format(calendarMonth, "MMMM yyyy")}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setCalendarMonth((m) => addMonths(m, 1))}>→</Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">{d}</div>
                  ))}
                  {/* Padding for first day */}
                  {Array.from({ length: calendarDays[0].getDay() }).map((_, i) => (
                    <div key={`pad-${i}`} className="bg-background min-h-[80px]" />
                  ))}
                  {calendarDays.map((day) => {
                    const dayPosts = scheduledPosts.filter((p) => p.scheduled_at && isSameDay(new Date(p.scheduled_at), day));
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "bg-background min-h-[80px] p-1.5",
                          isToday && "ring-2 ring-primary/30 ring-inset"
                        )}
                      >
                        <span className={cn("text-xs", isToday ? "font-bold text-primary" : "text-muted-foreground")}>
                          {format(day, "d")}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {dayPosts.map((p) => (
                            <div
                              key={p.id}
                              className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20"
                              onClick={() => navigate(`/content-hub/${p.id}`)}
                            >
                              {p.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ContentHub;

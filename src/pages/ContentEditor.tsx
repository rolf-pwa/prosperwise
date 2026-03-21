import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Save, Loader2, Sparkles, Linkedin, BookText, Globe,
  Copy, Check, Clock, CalendarIcon, Wand2, RefreshCw, ChevronRight,
  FileDown, Search, FileText, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listGoogleDocs, getGoogleDoc } from "@/lib/google-api";

const PLATFORMS = [
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, desc: "Short-form post with hashtags" },
  { key: "substack", label: "Substack", icon: BookText, desc: "Newsletter-style article" },
  { key: "wix_blog", label: "Wix Blog", icon: Globe, desc: "SEO-optimized blog post" },
] as const;

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

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

const ContentEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("draft");
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // AI
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  // Platform versions
  const [versions, setVersions] = useState<PlatformVersion[]>([]);
  const [activePlatform, setActivePlatform] = useState<string>("linkedin");
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  // Google Docs import
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<"url" | "browse">("url");
  const [importUrl, setImportUrl] = useState("");
  const [importSearch, setImportSearch] = useState("");
  const [importDocs, setImportDocs] = useState<{ id: string; name: string; modifiedTime: string; webViewLink: string }[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const fetchPost = useCallback(async () => {
    if (!id) return;
    const { data, error } = await (supabase.from("content_posts" as any) as any)
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      toast.error("Post not found");
      navigate("/content-hub");
      return;
    }
    const post = data as any;
    setTitle(post.title);
    setBody(post.body);
    setStatus(post.status);
    setNotes(post.notes || "");
    if (post.scheduled_at) {
      const d = new Date(post.scheduled_at);
      setScheduledAt(d);
      setScheduledTime(format(d, "HH:mm"));
    }

    const { data: vers } = await (supabase.from("content_platform_versions" as any) as any)
      .select("*")
      .eq("post_id", id);
    setVersions((vers as any[]) || []);
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      let scheduled_at: string | null = null;
      if (scheduledAt) {
        const dt = new Date(scheduledAt);
        const [h, m] = scheduledTime.split(":").map(Number);
        dt.setHours(h, m, 0, 0);
        scheduled_at = dt.toISOString();
      }

      await (supabase.from("content_posts" as any) as any)
        .update({ title, body, status, scheduled_at, notes } as any)
        .eq("id", id);

      // Save platform versions
      for (const v of versions) {
        await (supabase.from("content_platform_versions" as any) as any)
          .upsert({
            id: v.id,
            post_id: id,
            platform: v.platform,
            title: v.title,
            body: v.body,
            published: v.published,
            external_url: v.external_url,
          } as any);
      }

      setLastSaved(new Date());
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const callContentAI = async (action: string, extra: Record<string, string> = {}) => {
    const { data, error } = await supabase.functions.invoke("content-ai", {
      body: { action, title, body, ...extra },
    });
    if (error) throw new Error(error.message);
    return data.content as string;
  };

  const handleGenerateDraft = async () => {
    if (!title.trim()) {
      toast.error("Enter a title first");
      return;
    }
    setAiLoading("generate");
    try {
      const content = await callContentAI("generate_draft");
      setBody(content);
      toast.success("Draft generated!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiLoading(null);
    }
  };

  const handleImprove = async () => {
    if (!body.trim()) return;
    setAiLoading("improve");
    try {
      const content = await callContentAI("improve");
      setBody(content);
      toast.success("Content improved!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiLoading(null);
    }
  };

  const handleRepurpose = async (platform: string) => {
    if (!body.trim()) {
      toast.error("Write or generate the main content first");
      return;
    }
    setAiLoading(`repurpose-${platform}`);
    try {
      const content = await callContentAI("repurpose", { platform });

      const existing = versions.find((v) => v.platform === platform);
      if (existing) {
        setVersions((prev) =>
          prev.map((v) => (v.platform === platform ? { ...v, body: content, title } : v))
        );
      } else {
        setVersions((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            post_id: id!,
            platform,
            title,
            body: content,
            published: false,
            published_at: null,
            external_url: null,
          },
        ]);
      }
      setActivePlatform(platform);
      toast.success(`${PLATFORMS.find((p) => p.key === platform)?.label} version generated!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiLoading(null);
    }
  };

  const handleCopyPlatform = (platform: string) => {
    const v = versions.find((x) => x.platform === platform);
    if (!v) return;
    const text = `${v.title}\n\n${v.body}`;
    navigator.clipboard.writeText(text);
    setCopiedPlatform(platform);
    toast.success(`${PLATFORMS.find((p) => p.key === platform)?.label} content copied!`);
    setTimeout(() => setCopiedPlatform(null), 2000);
  };

  const updateVersion = (platform: string, field: "title" | "body" | "external_url", value: string) => {
    setVersions((prev) =>
      prev.map((v) => (v.platform === platform ? { ...v, [field]: value } : v))
    );
  };

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) return;
    setImportLoading(true);
    try {
      const doc = await getGoogleDoc(importUrl.trim());
      setTitle(doc.name);
      setBody(doc.content);
      setImportOpen(false);
      setImportUrl("");
      toast.success(`Imported "${doc.name}" from Google Docs`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleBrowseDocs = async (searchQuery?: string) => {
    setBrowseLoading(true);
    try {
      const docs = await listGoogleDocs(searchQuery || undefined);
      setImportDocs(docs);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBrowseLoading(false);
    }
  };

  const handlePickDoc = async (docId: string) => {
    setImportLoading(true);
    try {
      const doc = await getGoogleDoc(docId);
      setTitle(doc.name);
      setBody(doc.content);
      setImportOpen(false);
      toast.success(`Imported "${doc.name}" from Google Docs`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImportLoading(false);
    }
  };

  const markPublished = (platform: string) => {
    setVersions((prev) =>
      prev.map((v) =>
        v.platform === platform ? { ...v, published: true, published_at: new Date().toISOString() } : v
      )
    );
    toast.success(`Marked as published on ${PLATFORMS.find((p) => p.key === platform)?.label}`);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </AppLayout>
    );
  }

  const activeVersion = versions.find((v) => v.platform === activePlatform);

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/content-hub")} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-muted-foreground">Saved {format(lastSaved, "h:mm a")}</span>
            )}
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main editor (2/3) */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-4">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Post title…"
                  className="text-lg font-semibold border-0 shadow-none px-0 focus-visible:ring-0"
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateDraft}
                    disabled={!!aiLoading}
                    className="gap-1.5"
                  >
                    {aiLoading === "generate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Generate Draft
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImprove}
                    disabled={!!aiLoading || !body.trim()}
                    className="gap-1.5"
                  >
                    {aiLoading === "improve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    Improve
                  </Button>
                  <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (o && importTab === "browse" && importDocs.length === 0) handleBrowseDocs(); }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <FileDown className="h-3.5 w-3.5" />
                        Import from Docs
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Import from Google Docs</DialogTitle>
                      </DialogHeader>
                      <Tabs value={importTab} onValueChange={(v) => { setImportTab(v as any); if (v === "browse" && importDocs.length === 0) handleBrowseDocs(); }}>
                        <TabsList className="w-full">
                          <TabsTrigger value="url" className="flex-1">Paste URL</TabsTrigger>
                          <TabsTrigger value="browse" className="flex-1">Browse Docs</TabsTrigger>
                        </TabsList>
                        <TabsContent value="url" className="space-y-3 pt-2">
                          <Input
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            placeholder="https://docs.google.com/document/d/..."
                          />
                          <Button
                            onClick={handleImportFromUrl}
                            disabled={importLoading || !importUrl.trim()}
                            className="w-full gap-2"
                          >
                            {importLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                            Import
                          </Button>
                        </TabsContent>
                        <TabsContent value="browse" className="space-y-3 pt-2">
                          <div className="flex gap-2">
                            <Input
                              value={importSearch}
                              onChange={(e) => setImportSearch(e.target.value)}
                              placeholder="Search your Docs…"
                              onKeyDown={(e) => e.key === "Enter" && handleBrowseDocs(importSearch)}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleBrowseDocs(importSearch)}
                              disabled={browseLoading}
                            >
                              {browseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                          </div>
                          <ScrollArea className="h-[280px]">
                            {browseLoading && importDocs.length === 0 ? (
                              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                            ) : importDocs.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">No Google Docs found</p>
                            ) : (
                              <div className="space-y-1">
                                {importDocs.map((doc) => (
                                  <button
                                    key={doc.id}
                                    onClick={() => handlePickDoc(doc.id)}
                                    disabled={importLoading}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-accent text-left transition-colors"
                                  >
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">{doc.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Modified {format(new Date(doc.modifiedTime), "MMM d, yyyy")}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </TabsContent>
                      </Tabs>
                    </DialogContent>
                  </Dialog>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your content here… or use AI to generate a draft."
                  className="min-h-[350px] resize-y"
                />
              </CardContent>
            </Card>

            {/* Platform versions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  Platform Versions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  {PLATFORMS.map((p) => {
                    const isLoading = aiLoading === `repurpose-${p.key}`;
                    const hasVersion = versions.some((v) => v.platform === p.key);
                    return (
                      <Button
                        key={p.key}
                        variant={hasVersion ? "default" : "outline"}
                        size="sm"
                        onClick={() => hasVersion ? setActivePlatform(p.key) : handleRepurpose(p.key)}
                        disabled={!!aiLoading}
                        className="gap-1.5"
                      >
                        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <p.icon className="h-3.5 w-3.5" />}
                        {p.label}
                        {!hasVersion && <ChevronRight className="h-3 w-3 ml-1" />}
                      </Button>
                    );
                  })}
                </div>

                {activeVersion ? (
                  <div className="space-y-3 border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const PIcon = PLATFORMS.find((p) => p.key === activePlatform)?.icon;
                          return PIcon ? <PIcon className="h-4 w-4" /> : null;
                        })()}
                        <span className="font-medium text-sm">
                          {PLATFORMS.find((p) => p.key === activePlatform)?.label}
                        </span>
                        {activeVersion.published && (
                          <Badge variant="default" className="text-[10px]">Published</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRepurpose(activePlatform)}
                          disabled={!!aiLoading}
                          className="gap-1"
                        >
                          <RefreshCw className="h-3 w-3" /> Regenerate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyPlatform(activePlatform)}
                          className="gap-1"
                        >
                          {copiedPlatform === activePlatform ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedPlatform === activePlatform ? "Copied!" : "Copy"}
                        </Button>
                        {!activeVersion.published && (
                          <Button size="sm" onClick={() => markPublished(activePlatform)} className="gap-1">
                            Mark Published
                          </Button>
                        )}
                      </div>
                    </div>
                    <Textarea
                      value={activeVersion.body}
                      onChange={(e) => updateVersion(activePlatform, "body", e.target.value)}
                      className="min-h-[200px] resize-y text-sm"
                    />
                    <div className="space-y-1">
                      <Label className="text-xs">External URL (after publishing)</Label>
                      <Input
                        value={activeVersion.external_url || ""}
                        onChange={(e) => updateVersion(activePlatform, "external_url", e.target.value)}
                        placeholder="https://linkedin.com/posts/..."
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Click a platform above to generate a repurposed version with AI
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar (1/3) */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Post Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-xs">Schedule</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn("w-full justify-start text-left", !scheduledAt && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {scheduledAt ? format(scheduledAt, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledAt}
                        onSelect={setScheduledAt}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {scheduledAt && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button variant="ghost" size="sm" onClick={() => setScheduledAt(undefined)} className="text-xs text-muted-foreground">
                        Clear
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-xs">Internal Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes for the team…"
                    className="min-h-[80px] text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Platform publish status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Publish Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {PLATFORMS.map((p) => {
                    const v = versions.find((x) => x.platform === p.key);
                    return (
                      <div key={p.key} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <p.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{p.label}</span>
                        </div>
                        {v ? (
                          v.published ? (
                            <Badge className="text-[10px]">Published</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Ready</Badge>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ContentEditor;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Loader2, Trash2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";

interface MarketingUpdate {
  id: string;
  title: string;
  url: string;
  target_governance_status: string;
  created_at: string;
}

export function MarketingUpdateWidget() {
  const [updates, setUpdates] = useState<MarketingUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("all");
  const [publishing, setPublishing] = useState(false);

  const fetchUpdates = async () => {
    const { data } = await supabase
      .from("marketing_updates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setUpdates((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchUpdates(); }, []);

  const handlePublish = async () => {
    if (!title.trim() || !url.trim()) return;
    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("marketing_updates").insert({
        title: title.trim(),
        url: url.trim(),
        target_governance_status: target,
        published_by: user.id,
      } as any);

      if (error) throw error;

      // Send notifications to targeted contacts
      await supabase.functions.invoke("notify-portal-request", {
        body: { notify_type: "marketing_update", title: title.trim(), url: url.trim(), target_governance_status: target },
      });

      toast.success("Update published & notifications sent");
      setTitle("");
      setUrl("");
      setTarget("all");
      setOpen(false);
      fetchUpdates();
    } catch (e: any) {
      toast.error(e.message || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("marketing_updates").delete().eq("id", id);
    fetchUpdates();
  };

  const TARGET_LABELS: Record<string, string> = {
    all: "All Contacts",
    sovereign: "Sovereign",
    stabilization: "Stabilization",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-4 w-4 text-sanctuary-bronze" />
          Updates
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Plus className="mr-1 h-3 w-3" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish Update</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q1 Market Commentary" />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contacts</SelectItem>
                    <SelectItem value="sovereign">Sovereign Only</SelectItem>
                    <SelectItem value="stabilization">Stabilization Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handlePublish} disabled={publishing || !title.trim() || !url.trim()} className="w-full">
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
                Publish & Notify
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : updates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No updates published yet.</p>
        ) : (
          <div className="space-y-2">
            {updates.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                <div className="min-w-0 flex-1">
                  <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline flex items-center gap-1">
                    {u.title}
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{format(new Date(u.created_at), "MMM d, yyyy")}</span>
                    <Badge variant="outline" className="text-[10px]">{TARGET_LABELS[u.target_governance_status] || u.target_governance_status}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDelete(u.id)}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

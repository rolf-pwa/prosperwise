import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, NotebookPen, Sparkles, Save, Plus } from "lucide-react";
import { RecapCard } from "@/components/recaps/RecapCard";
import { MentionTextarea } from "@/components/recaps/MentionTextarea";

interface Recap {
  id: string;
  recap_date: string;
  author_id: string;
  body: string;
  ai_draft: string;
  created_at: string;
  updated_at: string;
}

const Recaps = () => {
  const { user } = useAuth();
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newBody, setNewBody] = useState("");
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const fetchRecaps = async () => {
    const { data } = await (supabase.from("daily_recaps" as any) as any)
      .select("*")
      .order("recap_date", { ascending: false });
    const recapData = (data as Recap[]) || [];
    setRecaps(recapData);

    // Fetch author names from profiles
    const authorIds = [...new Set(recapData.map((r) => r.author_id))];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authorIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p) => {
        nameMap[p.user_id] = p.full_name || "Unknown";
      });
      setAuthorNames(nameMap);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRecaps(); }, []);

  const generateDraft = async (date: string) => {
    setGeneratingDraft(true);
    try {
      const { data, error } = await supabase.functions.invoke("recap-draft", { body: { date } });
      if (error) throw error;
      setNewBody(data.draft || "");
      toast({ title: "Draft generated", description: "AI recap draft is ready for editing." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate draft", variant: "destructive" });
    } finally {
      setGeneratingDraft(false);
    }
  };

  const saveNew = async () => {
    if (!user || !newBody.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase.from("daily_recaps" as any) as any).insert({
        recap_date: newDate,
        author_id: user.id,
        body: newBody,
        ai_draft: newBody,
      });
      if (error) throw error;
      toast({ title: "Recap saved" });
      setCreating(false);
      setNewBody("");
      fetchRecaps();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: string, body: string) => {
    setSaving(true);
    try {
      const { error } = await (supabase.from("daily_recaps" as any) as any)
        .update({ body })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Recap updated" });
      fetchRecaps();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteRecap = async (id: string) => {
    try {
      const { error } = await (supabase.from("daily_recaps" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Recap deleted" });
      setExpandedId(null);
      fetchRecaps();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleToggle = (id: string) => {
    if (expandedId === id) {
      // Collapsing — mark as read
      setReadIds((prev) => new Set(prev).add(id));
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <NotebookPen className="h-8 w-8" />
            Daily Recaps
          </h1>
          {!creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Recap
            </Button>
          )}
        </div>

        {creating && (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">New Daily Recap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-48"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateDraft(newDate)}
                  disabled={generatingDraft}
                >
                  {generatingDraft ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-1" />
                  )}
                  Generate AI Draft
                </Button>
              </div>
              <MentionTextarea
                value={newBody}
                onChange={setNewBody}
                placeholder="Write your daily recap here, or generate an AI draft first... Use @name to mention contacts or staff."
                rows={12}
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={saveNew} disabled={saving || !newBody.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Recap
                </Button>
                <Button variant="outline" onClick={() => { setCreating(false); setNewBody(""); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : recaps.length === 0 && !creating ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <NotebookPen className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No recaps yet. Click "New Recap" to create your first daily entry.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recaps.map((recap) => (
              <RecapCard
                key={recap.id}
                recap={recap}
                authorName={authorNames[recap.author_id] || "Unknown"}
                isAuthor={user?.id === recap.author_id}
                isExpanded={expandedId === recap.id}
                wasRead={readIds.has(recap.id)}
                onToggle={() => handleToggle(recap.id)}
                onSaveEdit={saveEdit}
                onDelete={deleteRecap}
                saving={saving}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Recaps;

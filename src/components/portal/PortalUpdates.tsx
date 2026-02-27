import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, ExternalLink, Loader2, Check } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Props {
  governanceStatus: string;
  contactId: string;
  portalToken: string;
}

interface Update {
  id: string;
  title: string;
  url: string;
  target_governance_status: string;
  created_at: string;
}

export function PortalUpdates({ governanceStatus, contactId, portalToken }: Props) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [updatesRes, readsRes] = await Promise.all([
        supabase
          .from("marketing_updates")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("marketing_update_reads" as any)
          .select("update_id")
          .eq("contact_id", contactId) as any,
      ]);

      const allUpdates = ((updatesRes.data as any[]) || []).filter(
        (u) => u.target_governance_status === "all" || u.target_governance_status === governanceStatus
      );
      setUpdates(allUpdates);

      const readSet = new Set<string>(
        ((readsRes.data as any[]) || []).map((r: any) => r.update_id)
      );
      setReadIds(readSet);
      setLoading(false);
    })();
  }, [governanceStatus, contactId]);

  const markAsRead = async (updateId: string) => {
    if (readIds.has(updateId)) return;
    setReadIds((prev) => new Set(prev).add(updateId));
    await (supabase.from("marketing_update_reads" as any) as any).insert({
      contact_id: contactId,
      update_id: updateId,
    });
  };

  const unreadUpdates = updates.filter((u) => !readIds.has(u.id));
  const readUpdates = updates.filter((u) => readIds.has(u.id));

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Megaphone className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold text-foreground font-serif">No Updates</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          There are no new updates at this time.
        </p>
      </div>
    );
  }

  const renderUpdateCard = (u: Update, isRead: boolean) => (
    <a
      key={u.id}
      href={u.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => markAsRead(u.id)}
      className={`w-full flex items-center justify-between gap-3 rounded-lg bg-card border border-border p-4 hover:bg-muted/50 transition-colors text-left group ${isRead ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${isRead ? "bg-muted border-border" : "bg-accent/10 border-accent/20"}`}>
          {isRead ? (
            <Check className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Megaphone className="h-4 w-4 text-accent" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{u.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(u.created_at), "MMM d, yyyy")}
          </p>
        </div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </a>
  );

  return (
    <div className="space-y-3">
      {unreadUpdates.length > 0 && (
        <div className="space-y-2">
          {unreadUpdates.map((u) => renderUpdateCard(u, false))}
        </div>
      )}

      {unreadUpdates.length === 0 && readUpdates.length > 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Check className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">All caught up!</p>
        </div>
      )}

      {readUpdates.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-2">
            Read ({readUpdates.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {readUpdates.map((u) => renderUpdateCard(u, true))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

/** Returns count of unread updates for badge use */
export function useUnreadUpdateCount(governanceStatus: string, contactId: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!contactId) return;
    (async () => {
      const [updatesRes, readsRes] = await Promise.all([
        supabase.from("marketing_updates").select("id").limit(100),
        (supabase.from("marketing_update_reads" as any) as any)
          .select("update_id")
          .eq("contact_id", contactId),
      ]);

      const allIds = ((updatesRes.data as any[]) || []).map((u) => u.id);
      const readSet = new Set(((readsRes.data as any[]) || []).map((r: any) => r.update_id));
      setCount(allIds.filter((id) => !readSet.has(id)).length);
    })();
  }, [governanceStatus, contactId]);

  return count;
}

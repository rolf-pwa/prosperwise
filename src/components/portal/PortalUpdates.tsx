import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  governanceStatus: string;
}

interface Update {
  id: string;
  title: string;
  url: string;
  target_governance_status: string;
  created_at: string;
}

export function PortalUpdates({ governanceStatus }: Props) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("marketing_updates")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      // Filter by governance status
      const filtered = ((data as any[]) || []).filter(
        (u) => u.target_governance_status === "all" || u.target_governance_status === governanceStatus
      );
      setUpdates(filtered);
      setLoading(false);
    })();
  }, [governanceStatus]);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold text-foreground font-serif">Updates</h2>
        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
          {updates.length}
        </span>
      </div>
      <div className="space-y-2">
        {updates.map((u) => (
          <a
            key={u.id}
            href={u.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between gap-3 rounded-lg bg-card border border-border p-4 hover:bg-muted/50 transition-colors text-left group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 border border-accent/20">
                <Megaphone className="h-4 w-4 text-accent" />
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
        ))}
      </div>
    </div>
  );
}

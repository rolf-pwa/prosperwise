import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

export default function Leads() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["discovery-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discovery_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumbs items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Discovery Leads" },
        ]} />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Discovery Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prospects from the Georgia Discovery Assistant
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !leads?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <UserPlus className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No discovery leads yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <Card key={lead.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-foreground">{lead.first_name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {lead.email && <span>{lead.email}</span>}
                        {lead.phone && <span>{lead.phone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        {lead.transition_type?.replace(/_/g, " ") || "Discovery"}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {lead.sovereignty_status?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>

                  {(lead.anxiety_anchor || lead.discovery_notes) && (
                    <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/30 p-3">
                      {lead.anxiety_anchor && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Anxiety Anchor</p>
                          <p className="text-sm text-foreground">{lead.anxiety_anchor}</p>
                        </div>
                      )}
                      {lead.vision_summary && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Vision</p>
                          <p className="text-sm text-foreground">{lead.vision_summary}</p>
                        </div>
                      )}
                      {lead.vineyard_summary && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Vineyard Summary</p>
                          <p className="text-sm text-foreground">{lead.vineyard_summary}</p>
                        </div>
                      )}
                      {lead.discovery_notes && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Notes</p>
                          <p className="text-sm text-foreground">{lead.discovery_notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-muted-foreground">
                    {format(new Date(lead.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

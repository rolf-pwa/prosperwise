import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, ArrowRight, Check } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function Leads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const convertMutation = useMutation({
    mutationFn: async (lead: NonNullable<typeof leads>[number]) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          first_name: lead.first_name,
          full_name: lead.first_name,
          email: lead.email,
          phone: lead.phone,
          governance_status: "stabilization",
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update lead status to converted
      await supabase
        .from("discovery_leads")
        .update({ sovereignty_status: "converted_to_contact" })
        .eq("id", lead.id);

      return data;
    },
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ["discovery-leads"] });
      toast.success("Lead converted to contact", {
        action: {
          label: "View Contact",
          onClick: () => navigate(`/contacts/${contact.id}`),
        },
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to convert lead");
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
            {leads.map((lead) => {
              const isConverted = lead.sovereignty_status === "converted_to_contact";
              return (
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
                        {isConverted ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                            <Check className="mr-1 h-3 w-3" />
                            Converted
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            {lead.sovereignty_status?.replace(/_/g, " ")}
                          </Badge>
                        )}
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

                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(lead.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                      {!isConverted && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => convertMutation.mutate(lead)}
                          disabled={convertMutation.isPending}
                        >
                          {convertMutation.isPending ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Convert to Contact
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

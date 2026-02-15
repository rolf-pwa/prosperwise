import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Database,
  Mail,
  ListTodo,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAuditAction, type FunctionCall } from "@/lib/vertex-ai";
import { toast } from "sonner";

interface ProposedUpdateCardProps {
  functionCall: FunctionCall;
  contactId?: string;
  isApproved: boolean;
  onApproved: () => void;
}

const CARD_CONFIG: Record<string, { icon: typeof Database; label: string; color: string }> = {
  propose_vineyard_update: { icon: Database, label: "Vineyard Update", color: "text-sanctuary-green" },
  propose_storehouse_update: { icon: Database, label: "Storehouse Update", color: "text-sanctuary-bronze" },
  draft_stabilization_email: { icon: Mail, label: "Draft Email", color: "text-blue-500" },
  draft_asana_task: { icon: ListTodo, label: "Draft Task", color: "text-purple-500" },
};

export function ProposedUpdateCard({ functionCall, contactId, isApproved, onApproved }: ProposedUpdateCardProps) {
  const [loading, setLoading] = useState(false);
  const config = CARD_CONFIG[functionCall.name] || { icon: Database, label: "Action", color: "text-foreground" };
  const Icon = config.icon;
  const args = functionCall.args;

  const handleApprove = async () => {
    setLoading(true);
    try {
      const cid = args.contact_id || contactId;

      switch (functionCall.name) {
        case "propose_vineyard_update": {
          const updates: Record<string, any> = {};
          if (args.vineyard_ebitda != null) updates.vineyard_ebitda = args.vineyard_ebitda;
          if (args.vineyard_operating_income != null) updates.vineyard_operating_income = args.vineyard_operating_income;
          if (args.vineyard_balance_sheet_summary) updates.vineyard_balance_sheet_summary = args.vineyard_balance_sheet_summary;

          if (Object.keys(updates).length > 0 && cid) {
            const { error } = await supabase.from("contacts").update(updates).eq("id", cid);
            if (error) throw error;
          }

          if (cid) {
            await logAuditAction(
              cid,
              "vineyard_update",
              `AI Assistant proposed Vineyard update for ${args.contact_name}: ${args.rationale}`,
              args
            );
          }
          toast.success("Vineyard data updated & logged to audit trail.");
          break;
        }

        case "propose_storehouse_update": {
          if (!cid) throw new Error("No contact ID");
          const storehouseData: Record<string, any> = {
            contact_id: cid,
            storehouse_number: args.storehouse_number,
          };
          if (args.label) storehouseData.label = args.label;
          if (args.asset_type) storehouseData.asset_type = args.asset_type;
          if (args.risk_cap) storehouseData.risk_cap = args.risk_cap;
          if (args.charter_alignment) storehouseData.charter_alignment = args.charter_alignment;
          if (args.notes) storehouseData.notes = args.notes;

          // Upsert: check if storehouse exists
          const { data: existing } = await supabase
            .from("storehouses")
            .select("id")
            .eq("contact_id", cid)
            .eq("storehouse_number", args.storehouse_number)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase.from("storehouses").update(storehouseData).eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("storehouses").insert(storehouseData as any);
            if (error) throw error;
          }

          await logAuditAction(
            cid,
            "storehouse_update",
            `AI Assistant proposed Storehouse ${args.storehouse_number} update for ${args.contact_name}: ${args.rationale}`,
            args
          );
          toast.success("Storehouse updated & logged to audit trail.");
          break;
        }

        case "draft_stabilization_email": {
          // Open Gmail compose with pre-filled content (draft mode)
          const gmailUrl = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodeURIComponent(args.to_email)}&su=${encodeURIComponent(args.subject)}&body=${encodeURIComponent(args.body)}`;
          window.open(gmailUrl, "_blank");

          if (cid) {
            await logAuditAction(
              cid,
              "draft_email",
              `AI Assistant drafted Stabilization Email for ${args.to_name}: "${args.subject}"`,
              args
            );
          }
          toast.success("Email draft opened in Gmail. Review before sending.");
          break;
        }

        case "draft_asana_task": {
          // Copy task content to clipboard (link-only mode)
          const taskText = `${args.task_title}\n\n${args.task_description}\n\nContact: ${args.contact_name}\nPriority: ${args.priority || "medium"}`;
          await navigator.clipboard.writeText(taskText);

          if (cid) {
            await logAuditAction(
              cid,
              "draft_task",
              `AI Assistant drafted Asana task "${args.task_title}" for ${args.contact_name}`,
              args
            );
          }
          toast.success("Task copied to clipboard. Paste into Asana to create.");
          break;
        }
      }

      onApproved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to execute action");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-sanctuary-bronze/30 bg-accent/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className="text-xs font-semibold uppercase tracking-wider">{config.label}</span>
          <Badge variant="outline" className="ml-auto text-[10px]">
            📋 Draft for CFO Review
          </Badge>
        </div>

        {/* Render args as key-value pairs */}
        <dl className="space-y-1 text-xs">
          {Object.entries(args)
            .filter(([key]) => !["contact_id"].includes(key))
            .map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="text-muted-foreground capitalize min-w-[100px]">
                  {key.replace(/_/g, " ")}:
                </dt>
                <dd className="font-medium flex-1">
                  {typeof value === "number"
                    ? `$${value.toLocaleString()}`
                    : String(value)}
                </dd>
              </div>
            ))}
        </dl>

        {isApproved ? (
          <div className="flex items-center gap-1.5 text-xs text-sanctuary-green">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-medium">Approved by Personal CFO</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={loading}
            className="w-full bg-sanctuary-green text-primary-foreground hover:bg-sanctuary-green/90"
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Approve & Sync
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

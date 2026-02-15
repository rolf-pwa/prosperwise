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
  UserPlus,
  UserCog,
  CalendarPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAuditAction, type FunctionCall } from "@/lib/vertex-ai";
import { createGmailDraft } from "@/lib/google-api";
import { createCalendarEvent } from "@/lib/google-api";
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
  create_contact: { icon: UserPlus, label: "New Contact", color: "text-emerald-500" },
  update_contact: { icon: UserCog, label: "Update Contact", color: "text-amber-500" },
  schedule_meeting: { icon: CalendarPlus, label: "Schedule Meeting", color: "text-indigo-500" },
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
          // Save as Gmail draft via API
          await createGmailDraft(args.to_email, args.subject, args.body);

          if (cid) {
            await logAuditAction(
              cid,
              "draft_email",
              `AI Assistant drafted email for ${args.to_name}: "${args.subject}" — saved to Gmail Drafts`,
              args
            );
          }
          toast.success("Email saved to Gmail Drafts. Open Gmail to review & send.");
          break;
        }

        case "draft_asana_task": {
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

        case "create_contact": {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          const fullName = [args.first_name, args.last_name].filter(Boolean).join(" ");
          const contactData: Record<string, any> = {
            first_name: args.first_name,
            full_name: fullName,
            created_by: user.id,
          };
          if (args.last_name) contactData.last_name = args.last_name;
          if (args.email) contactData.email = args.email;
          if (args.phone) contactData.phone = args.phone;
          if (args.address) contactData.address = args.address;
          if (args.fiduciary_entity) contactData.fiduciary_entity = args.fiduciary_entity;
          if (args.governance_status) contactData.governance_status = args.governance_status;

          const { data: newContact, error } = await supabase
            .from("contacts")
            .insert(contactData as any)
            .select("id")
            .single();
          if (error) throw error;

          await logAuditAction(
            newContact.id,
            "create_contact",
            `AI Assistant created contact "${fullName}": ${args.rationale}`,
            args
          );
          toast.success(`Contact "${fullName}" created successfully.`);
          break;
        }

        case "update_contact": {
          if (!cid) throw new Error("No contact ID");
          const updates: Record<string, any> = {};
          const fieldsToCopy = [
            "first_name", "last_name", "email", "phone", "address",
            "fiduciary_entity", "governance_status", "google_drive_url",
            "asana_url", "sidedrawer_url", "ia_financial_url",
            "lawyer_name", "lawyer_firm", "accountant_name", "accountant_firm",
          ];
          for (const field of fieldsToCopy) {
            if (args[field] != null) updates[field] = args[field];
          }
          // Recompute full_name if name fields changed
          if (updates.first_name || updates.last_name) {
            const { data: current } = await supabase.from("contacts").select("first_name, last_name").eq("id", cid).single();
            const fn = updates.first_name || current?.first_name || "";
            const ln = updates.last_name ?? current?.last_name ?? "";
            updates.full_name = [fn, ln].filter(Boolean).join(" ");
          }

          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from("contacts").update(updates).eq("id", cid);
            if (error) throw error;
          }

          await logAuditAction(
            cid,
            "update_contact",
            `AI Assistant updated contact "${args.contact_name}": ${args.rationale}`,
            args
          );
          toast.success(`Contact "${args.contact_name}" updated.`);
          break;
        }

        case "schedule_meeting": {
          const tz = args.timezone || "America/Toronto";
          const attendees = args.attendees
            ? args.attendees.split(",").map((e: string) => ({ email: e.trim() }))
            : [];

          await createCalendarEvent({
            summary: args.summary,
            description: args.description || "",
            start: { dateTime: args.start_datetime, timeZone: tz },
            end: { dateTime: args.end_datetime, timeZone: tz },
            attendees,
          });

          if (cid) {
            await logAuditAction(
              cid,
              "schedule_meeting",
              `AI Assistant scheduled meeting "${args.summary}" for ${args.contact_name || "N/A"}: ${args.rationale}`,
              args
            );
          }
          toast.success(`Meeting "${args.summary}" scheduled on Google Calendar.`);
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

  // Fields to hide from display
  const hiddenFields = ["contact_id"];

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
            .filter(([key]) => !hiddenFields.includes(key))
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

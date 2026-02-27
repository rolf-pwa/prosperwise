import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { InlineEdit } from "@/components/InlineEdit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  Trash2,
  Users,
  DollarSign,
  User,
  Percent,
  Crown,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  opco: "Operating Co.",
  holdco: "Holding Co.",
  trust: "Trust",
  partnership: "Partnership",
  other: "Other",
};

interface Shareholder {
  id: string;
  contact_id: string;
  ownership_percentage: number;
  share_class: string | null;
  role_title: string | null;
  is_active: boolean;
  contact_name: string;
  contact_email: string | null;
  family_name: string | null;
}

interface CorpAccount {
  id: string;
  account_name: string;
  account_number: string | null;
  account_type: string;
  current_value: number;
  notes: string | null;
}

const CorporationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [corp, setCorp] = useState<any>(null);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [accounts, setAccounts] = useState<CorpAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Add shareholder dialog
  const [showAddShareholder, setShowAddShareholder] = useState(false);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [ownershipPct, setOwnershipPct] = useState("0");
  const [shareClass, setShareClass] = useState("Common");
  const [roleTitle, setRoleTitle] = useState("");

  // Add account dialog
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState("Portfolio");
  const [newAccValue, setNewAccValue] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;

    const [corpRes, shRes, accRes] = await Promise.all([
      (supabase.from("corporations" as any) as any).select("*").eq("id", id).single(),
      (supabase.from("shareholders" as any) as any).select("*").eq("corporation_id", id).order("ownership_percentage", { ascending: false }),
      (supabase.from("corporate_vineyard_accounts" as any) as any).select("*").eq("corporation_id", id).order("account_name"),
    ]);

    if (corpRes.error || !corpRes.data) {
      navigate("/corporations");
      return;
    }

    setCorp(corpRes.data);
    setAccounts(
      ((accRes.data || []) as any[]).map((a: any) => ({
        ...a,
        current_value: Number(a.current_value || 0),
      }))
    );

    // Resolve shareholder contact names
    const shData = (shRes.data || []) as any[];
    if (shData.length > 0) {
      const contactIds = shData.map((s: any) => s.contact_id);
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, full_name, email, family_id")
        .in("id", contactIds);

      // Get family names for linked contacts
      const familyIds = (contacts || []).filter((c: any) => c.family_id).map((c: any) => c.family_id);
      const { data: familyData } = familyIds.length > 0
        ? await (supabase.from("families" as any) as any).select("id, name").in("id", familyIds)
        : { data: [] };

      const familyMap: Record<string, string> = {};
      ((familyData || []) as any[]).forEach((f: any) => { familyMap[f.id] = f.name; });

      const contactMap: Record<string, any> = {};
      (contacts || []).forEach((c: any) => { contactMap[c.id] = c; });

      setShareholders(
        shData.map((s: any) => ({
          ...s,
          ownership_percentage: Number(s.ownership_percentage),
          contact_name: contactMap[s.contact_id]?.full_name || "Unknown",
          contact_email: contactMap[s.contact_id]?.email || null,
          family_name: contactMap[s.contact_id]?.family_id
            ? familyMap[contactMap[s.contact_id].family_id] || null
            : null,
        }))
      );
    } else {
      setShareholders([]);
    }

    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateField = async (field: string, value: any) => {
    const { error } = await (supabase.from("corporations" as any) as any)
      .update({ [field]: value })
      .eq("id", id);
    if (error) toast.error(`Failed to update ${field}`);
    else { toast.success("Updated."); fetchData(); }
  };

  const deleteCorp = async () => {
    const { error } = await (supabase.from("corporations" as any) as any).delete().eq("id", id);
    if (error) toast.error("Failed to delete corporation.");
    else { toast.success("Corporation deleted."); navigate("/corporations"); }
  };

  const openAddShareholder = async () => {
    const { data } = await supabase.from("contacts").select("id, full_name, email").order("full_name");
    const existingIds = new Set(shareholders.map((s) => s.contact_id));
    setAllContacts((data || []).filter((c: any) => !existingIds.has(c.id)));
    setSelectedContactId("");
    setOwnershipPct("0");
    setShareClass("Common");
    setRoleTitle("");
    setShowAddShareholder(true);
  };

  const addShareholder = async () => {
    if (!selectedContactId || !id) return;
    const { error } = await (supabase.from("shareholders" as any) as any)
      .insert({
        contact_id: selectedContactId,
        corporation_id: id,
        ownership_percentage: Number(ownershipPct) || 0,
        share_class: shareClass || "Common",
        role_title: roleTitle || null,
      });
    if (error) toast.error("Failed to add shareholder.");
    else { toast.success("Shareholder added."); setShowAddShareholder(false); fetchData(); }
  };

  const removeShareholder = async (shareholderId: string) => {
    const { error } = await (supabase.from("shareholders" as any) as any).delete().eq("id", shareholderId);
    if (error) toast.error("Failed to remove shareholder.");
    else { toast.success("Shareholder removed."); fetchData(); }
  };

  const addAccount = async () => {
    if (!newAccName.trim() || !id) return;
    const { error } = await (supabase.from("corporate_vineyard_accounts" as any) as any)
      .insert({
        corporation_id: id,
        account_name: newAccName.trim(),
        account_type: newAccType,
        current_value: Number(newAccValue) || 0,
      });
    if (error) toast.error("Failed to add account.");
    else {
      toast.success("Account added.");
      setNewAccName("");
      setNewAccType("Portfolio");
      setNewAccValue("");
      setShowAddAccount(false);
      fetchData();
    }
  };

  const deleteAccount = async (accountId: string) => {
    const { error } = await (supabase.from("corporate_vineyard_accounts" as any) as any).delete().eq("id", accountId);
    if (error) toast.error("Failed to delete account.");
    else { toast.success("Account deleted."); fetchData(); }
  };

  if (loading) {
    return <AppLayout><p className="p-8 text-muted-foreground">Loading…</p></AppLayout>;
  }

  if (!corp) return null;

  const totalAssets = accounts.reduce((sum, a) => sum + a.current_value, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumbs items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Corporations", href: "/corporations" },
          { label: corp.name },
        ]} />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Building2 className="h-7 w-7 text-accent" />
              <InlineEdit value={corp.name} onSave={(v) => updateField("name", v)} className="text-3xl font-bold font-serif" />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Badge variant="outline">{TYPE_LABELS[corp.corporation_type] || corp.corporation_type}</Badge>
              {corp.jurisdiction && <span className="text-sm text-muted-foreground">{corp.jurisdiction}</span>}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {corp.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the corporation, all shareholder links, and corporate accounts. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteCorp} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Shareholders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-accent" /> Shareholders
              </CardTitle>
              <Button size="sm" variant="outline" onClick={openAddShareholder} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {shareholders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No shareholders linked.</p>
              ) : (
                shareholders.map((sh) => (
                  <div key={sh.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <Link to={`/contacts/${sh.contact_id}`} className="text-sm font-medium text-foreground hover:text-accent transition-colors">
                          {sh.contact_name}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Percent className="h-3 w-3" /> {sh.ownership_percentage}%
                          </span>
                          {sh.share_class && <span>· {sh.share_class}</span>}
                          {sh.role_title && <span>· {sh.role_title}</span>}
                          {sh.family_name && (
                            <Badge variant="outline" className="text-[9px] ml-1">
                              <Crown className="h-2.5 w-2.5 mr-0.5" /> {sh.family_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeShareholder(sh.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Corporate Vineyard */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-accent" /> Corporate Vineyard
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ${totalAssets.toLocaleString()}
                </span>
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAddAccount(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Account
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No corporate accounts.</p>
              ) : (
                accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{acc.account_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {acc.account_type}{acc.account_number ? ` · ${acc.account_number}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">${acc.current_value.toLocaleString()}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteAccount(acc.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}

              {/* Pro-rata shareholder breakdown */}
              {totalAssets > 0 && shareholders.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Pro-Rata Sovereign Stakes
                  </p>
                  {shareholders.map((sh) => {
                    const proRata = totalAssets * (sh.ownership_percentage / 100);
                    return (
                      <div key={sh.id} className="flex items-center justify-between py-1 text-xs">
                        <span className="text-muted-foreground">{sh.contact_name} ({sh.ownership_percentage}%)</span>
                        <span className="font-medium">${proRata.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Details card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Jurisdiction</label>
              <InlineEdit value={corp.jurisdiction || ""} onSave={(v) => updateField("jurisdiction", v || null)} placeholder="Enter jurisdiction…" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fiscal Year End</label>
              <InlineEdit value={corp.fiscal_year_end || ""} onSave={(v) => updateField("fiscal_year_end", v || null)} placeholder="e.g. December 31" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Asana Project</label>
              {corp.asana_project_url ? (
                <a href={corp.asana_project_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline flex items-center gap-1">
                  Open in Asana <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <InlineEdit value="" onSave={(v) => updateField("asana_project_url", v || null)} placeholder="Paste Asana project URL…" />
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <InlineEdit value={corp.notes || ""} onSave={(v) => updateField("notes", v || null)} placeholder="Add notes…" />
            </div>
          </CardContent>
        </Card>

        {/* Add Shareholder Dialog */}
        <Dialog open={showAddShareholder} onOpenChange={setShowAddShareholder}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Shareholder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium">Contact</label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger><SelectValue placeholder="Select a contact…" /></SelectTrigger>
                  <SelectContent>
                    {allContacts.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}{c.email ? ` (${c.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Ownership %</label>
                  <Input type="number" min="0" max="100" value={ownershipPct} onChange={(e) => setOwnershipPct(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Share Class</label>
                  <Input value={shareClass} onChange={(e) => setShareClass(e.target.value)} placeholder="Common" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Role / Title</label>
                <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="e.g. Director, President" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddShareholder(false)}>Cancel</Button>
              <Button onClick={addShareholder} disabled={!selectedContactId}>Add Shareholder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Account Dialog */}
        <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Corporate Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium">Account Name</label>
                <Input value={newAccName} onChange={(e) => setNewAccName(e.target.value)} placeholder="e.g. Corporate Investment Portfolio" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Input value={newAccType} onChange={(e) => setNewAccType(e.target.value)} placeholder="Portfolio" />
                </div>
                <div>
                  <label className="text-sm font-medium">Current Value</label>
                  <Input type="number" value={newAccValue} onChange={(e) => setNewAccValue(e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddAccount(false)}>Cancel</Button>
              <Button onClick={addAccount} disabled={!newAccName.trim()}>Add Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default CorporationDetail;

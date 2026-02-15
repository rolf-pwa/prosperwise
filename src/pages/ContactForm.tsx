import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, X, Plus, Search } from "lucide-react";

interface LinkedMember {
  relationship_id?: string;
  contact_id: string;
  full_name: string;
  relationship_label: string;
  isNew?: boolean; // true if we need to create the contact
}

const ContactForm = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: searchParams.get("full_name") || "",
    email: "",
    phone: "",
    address: "",
    governance_status: "stabilization" as "stabilization" | "sovereign",
    fiduciary_entity: "pws" as "pws" | "pwa",
    lawyer_name: "",
    lawyer_firm: "",
    accountant_name: "",
    accountant_firm: "",
    vineyard_ebitda: "",
    vineyard_operating_income: "",
    vineyard_balance_sheet_summary: "",
    quiet_period_start_date: "",
    sidedrawer_url: "",
    asana_url: "",
    ia_financial_url: "",
    google_drive_url: "",
  });

  // Household member linking
  const [householdMembers, setHouseholdMembers] = useState<LinkedMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberLabel, setMemberLabel] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string }[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Search contacts for household linking
  const searchContacts = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("contacts")
      .select("id, full_name")
      .ilike("full_name", `%${query}%`)
      .neq("id", id || "")
      .limit(5);
    setSearchResults(data || []);
    setShowResults(true);
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => searchContacts(memberSearch), 300);
    return () => clearTimeout(timer);
  }, [memberSearch, searchContacts]);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [contactRes, householdRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("household_relationships")
          .select("id, member_contact_id, relationship_label, contact:contacts!household_relationships_member_contact_id_fkey(id, full_name)")
          .eq("contact_id", id),
      ]);
      const data = contactRes.data;
      if (!data) return;
      setForm({
        full_name: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        governance_status: data.governance_status as any,
        fiduciary_entity: data.fiduciary_entity as any,
        lawyer_name: data.lawyer_name || "",
        lawyer_firm: data.lawyer_firm || "",
        accountant_name: data.accountant_name || "",
        accountant_firm: data.accountant_firm || "",
        vineyard_ebitda: data.vineyard_ebitda?.toString() || "",
        vineyard_operating_income: data.vineyard_operating_income?.toString() || "",
        vineyard_balance_sheet_summary: data.vineyard_balance_sheet_summary || "",
        quiet_period_start_date: data.quiet_period_start_date || "",
        sidedrawer_url: data.sidedrawer_url || "",
        asana_url: data.asana_url || "",
        ia_financial_url: data.ia_financial_url || "",
        google_drive_url: data.google_drive_url || "",
      });
      setHouseholdMembers(
        (householdRes.data || []).map((r: any) => ({
          relationship_id: r.id,
          contact_id: r.member_contact_id,
          full_name: r.contact?.full_name || "Unknown",
          relationship_label: r.relationship_label || "",
        }))
      );
    }
    load();
  }, [id]);

  function addExistingMember(contact: { id: string; full_name: string }) {
    if (householdMembers.some((m) => m.contact_id === contact.id)) {
      toast.error("Already added.");
      return;
    }
    setHouseholdMembers((prev) => [
      ...prev,
      { contact_id: contact.id, full_name: contact.full_name, relationship_label: memberLabel },
    ]);
    setMemberSearch("");
    setMemberLabel("");
    setShowResults(false);
  }

  async function addNewMember(name: string) {
    if (!user) return;
    setHouseholdMembers((prev) => [
      ...prev,
      { contact_id: "", full_name: name, relationship_label: memberLabel, isNew: true },
    ]);
    setMemberSearch("");
    setMemberLabel("");
    setShowResults(false);
  }

  function removeMember(index: number) {
    setHouseholdMembers((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveHouseholdMembers(contactId: string) {
    // Delete existing relationships
    await supabase.from("household_relationships").delete().eq("contact_id", contactId);

    for (const member of householdMembers) {
      let memberId = member.contact_id;

      // Create new contact if needed
      if (member.isNew || !memberId) {
        const { data } = await supabase
          .from("contacts")
          .insert({ full_name: member.full_name, created_by: user!.id })
          .select("id")
          .single();
        if (data) memberId = data.id;
        else continue;
      }

      await supabase.from("household_relationships").insert({
        contact_id: contactId,
        member_contact_id: memberId,
        relationship_label: member.relationship_label || null,
      });
    }
  }

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Full name is required.");
      return;
    }

    setSaving(true);

    const payload = {
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      governance_status: form.governance_status,
      fiduciary_entity: form.fiduciary_entity,
      lawyer_name: form.lawyer_name || null,
      lawyer_firm: form.lawyer_firm || null,
      accountant_name: form.accountant_name || null,
      accountant_firm: form.accountant_firm || null,
      vineyard_ebitda: form.vineyard_ebitda ? Number(form.vineyard_ebitda) : null,
      vineyard_operating_income: form.vineyard_operating_income
        ? Number(form.vineyard_operating_income)
        : null,
      vineyard_balance_sheet_summary:
        form.vineyard_balance_sheet_summary || null,
      quiet_period_start_date: form.quiet_period_start_date || null,
      sidedrawer_url: form.sidedrawer_url || null,
      asana_url: form.asana_url || null,
      ia_financial_url: form.ia_financial_url || null,
      google_drive_url: form.google_drive_url || null,
    };

    let contactId = id;

    if (isEdit) {
      const { error } = await supabase
        .from("contacts")
        .update(payload)
        .eq("id", id!);
      if (error) {
        toast.error("Failed to update contact.");
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("contacts")
        .insert({ ...payload, created_by: user!.id })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Failed to create contact.");
        setSaving(false);
        return;
      }
      contactId = data.id;
    }

    // Save household relationships
    await saveHouseholdMembers(contactId!);

    toast.success(isEdit ? "Contact updated." : "Contact created.");
    navigate(`/contacts/${contactId}`);
    setSaving(false);
  }

  return (
    <AppLayout>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(isEdit ? `/contacts/${id}` : "/contacts")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">
            {isEdit ? "Edit Contact" : "New Contact"}
          </h1>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Governance & Fiduciary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Governance & Fiduciary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Governance Status</Label>
              <Select value={form.governance_status} onValueChange={(v) => update("governance_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stabilization">Stabilization Phase (Pre-Charter)</SelectItem>
                  <SelectItem value="sovereign">Sovereign Phase (Ratified Charter)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fiduciary Entity</Label>
              <Select value={form.fiduciary_entity} onValueChange={(v) => update("fiduciary_entity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pws">PWS — Strategy / Architect</SelectItem>
                  <SelectItem value="pwa">PWA — Advisors / Builder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="quiet_period_start_date">Quiet Period Start Date</Label>
              <Input
                id="quiet_period_start_date"
                type="date"
                value={form.quiet_period_start_date}
                onChange={(e) => update("quiet_period_start_date", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Professional Team */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Professional Team</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Lawyer Name</Label>
              <Input value={form.lawyer_name} onChange={(e) => update("lawyer_name", e.target.value)} />
            </div>
            <div>
              <Label>Lawyer Firm</Label>
              <Input value={form.lawyer_firm} onChange={(e) => update("lawyer_firm", e.target.value)} />
            </div>
            <div>
              <Label>Accountant Name</Label>
              <Input value={form.accountant_name} onChange={(e) => update("accountant_name", e.target.value)} />
            </div>
            <div>
              <Label>Accountant Firm</Label>
              <Input value={form.accountant_firm} onChange={(e) => update("accountant_firm", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* The Vineyard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">The Vineyard — Entity Data</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>EBITDA ($)</Label>
              <Input type="number" value={form.vineyard_ebitda} onChange={(e) => update("vineyard_ebitda", e.target.value)} />
            </div>
            <div>
              <Label>Operating Income ($)</Label>
              <Input type="number" value={form.vineyard_operating_income} onChange={(e) => update("vineyard_operating_income", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Balance Sheet Summary</Label>
              <Textarea value={form.vineyard_balance_sheet_summary} onChange={(e) => update("vineyard_balance_sheet_summary", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Household & Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Household & Resources</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-3">
              <Label>Household Members</Label>

              {/* Linked members list */}
              {householdMembers.length > 0 && (
                <div className="space-y-1">
                  {householdMembers.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <span className="flex-1 text-sm font-medium">{m.full_name}</span>
                      {m.relationship_label && (
                        <Badge variant="secondary" className="text-xs">{m.relationship_label}</Badge>
                      )}
                      {m.isNew && (
                        <Badge variant="outline" className="text-xs">New contact</Badge>
                      )}
                      <button type="button" onClick={() => removeMember(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search / Add */}
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="relative sm:col-span-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search existing contacts..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    onFocus={() => memberSearch.length >= 2 && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    className="pl-9"
                  />
                  {showResults && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {searchResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-center px-3 py-2 text-sm hover:bg-muted"
                          onMouseDown={() => addExistingMember(c)}
                        >
                          {c.full_name}
                        </button>
                      ))}
                      {memberSearch.length >= 2 && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm text-sanctuary-bronze hover:bg-muted"
                          onMouseDown={() => addNewMember(memberSearch)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create "{memberSearch}" as new contact
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <Input
                  placeholder="Relationship (e.g. Spouse)"
                  value={memberLabel}
                  onChange={(e) => setMemberLabel(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>SideDrawer URL</Label>
              <Input value={form.sidedrawer_url} onChange={(e) => update("sidedrawer_url", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Asana URL</Label>
              <Input value={form.asana_url} onChange={(e) => update("asana_url", e.target.value)} placeholder="https://..." />
            </div>
             <div>
               <Label>IA Financial URL</Label>
               <Input value={form.ia_financial_url} onChange={(e) => update("ia_financial_url", e.target.value)} placeholder="https://..." />
             </div>
             <div>
               <Label>Google Drive Folder URL</Label>
               <Input value={form.google_drive_url} onChange={(e) => update("google_drive_url", e.target.value)} placeholder="https://drive.google.com/..." />
             </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="bg-sanctuary-bronze text-sanctuary-charcoal hover:bg-sanctuary-bronze/90">
            {saving ? "Saving..." : isEdit ? "Update Contact" : "Create Contact"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(isEdit ? `/contacts/${id}` : "/contacts")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </AppLayout>
  );
};

export default ContactForm;

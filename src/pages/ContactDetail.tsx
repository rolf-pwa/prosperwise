import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Clock,
  Shield,
  ExternalLink,
  Folder,
  CheckSquare,
  ShieldCheck,
  AlertCircle,
  FolderOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { differenceInDays, addDays, format } from "date-fns";
import { toast } from "sonner";
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
import { ContactEmails } from "@/components/ContactEmails";
import { ContactCalendar } from "@/components/ContactCalendar";
import { ContactLinker } from "@/components/ContactLinker";
import { ProfessionalLinker } from "@/components/ProfessionalLinker";
import { SovereigntyAssistant } from "@/components/SovereigntyAssistant";
import { AuditTrail } from "@/components/AuditTrail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot } from "lucide-react";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PortalMagicLinkButton } from "@/components/portal/PortalMagicLinkButton";
import { AssetContainer, type AssetAccount, type MoveTarget } from "@/components/AssetContainer";
import { Grape } from "lucide-react";

interface Storehouse {
  id: string;
  storehouse_number: number;
  label: string;
  asset_type: string | null;
  risk_cap: string | null;
  charter_alignment: string;
  notes: string | null;
  visibility_scope: string;
  current_value: number | null;
  target_value: number | null;
}

interface HouseholdMember {
  id: string;
  member_contact_id: string;
  relationship_label: string | null;
  contact: { id: string; first_name: string; last_name: string | null } | null;
}

const STOREHOUSE_LABELS = [
  "The Keep — Liquidity Reserve",
  "The Armoury — Strategic Reserve",
  "The Granary — Philanthropic Trust",
  "The Vault — Legacy Trust",
];

const STOREHOUSE_NAMES = [
  "The Keep",
  "The Armoury",
  "The Granary",
  "The Vault",
];

interface VineyardAccount {
  id: string;
  account_name: string;
  account_type: string;
  current_value: number | null;
  notes: string | null;
  visibility_scope: string;
}


const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<any>(null);
  const [storehouses, setStorehouses] = useState<Storehouse[]>([]);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [familyMembers, setFamilyMembers] = useState<HouseholdMember[]>([]);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [householdLabel, setHouseholdLabel] = useState<string | null>(null);
  const [vineyardAccounts, setVineyardAccounts] = useState<VineyardAccount[]>([]);
  const [professionalContacts, setProfessionalContacts] = useState<Record<string, { id: string; full_name: string } | null>>({});
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("Portfolio");
  const [newAccountValue, setNewAccountValue] = useState("");
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [contactRes, storehouseRes, householdRes, familyRes, accountsRes] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("storehouses")
        .select("*")
        .eq("contact_id", id)
        .order("storehouse_number"),
      supabase
        .from("household_relationships")
        .select("id, member_contact_id, relationship_label, contact:contacts!household_relationships_member_contact_id_fkey(id, first_name, last_name)")
        .eq("contact_id", id),
      supabase
        .from("family_relationships")
        .select("id, member_contact_id, relationship_label, contact:contacts!family_relationships_member_contact_id_fkey(id, first_name, last_name)")
        .eq("contact_id", id),
      supabase
        .from("vineyard_accounts" as any)
        .select("*")
        .eq("contact_id", id)
        .order("created_at"),
    ]);
    setContact(contactRes.data);
    setStorehouses(storehouseRes.data || []);
    setHouseholdMembers((householdRes.data as any) || []);
    setFamilyMembers((familyRes.data as any) || []);
    setVineyardAccounts((accountsRes.data as any) || []);

    // Fetch family & household names for breadcrumbs
    if (contactRes.data?.family_id) {
      const { data: fam } = await supabase.from("families").select("name").eq("id", contactRes.data.family_id).maybeSingle();
      setFamilyName(fam?.name || null);
    }
    if (contactRes.data?.household_id) {
      const { data: hh } = await supabase.from("households").select("label").eq("id", contactRes.data.household_id).maybeSingle();
      setHouseholdLabel(hh?.label || null);
    }

    // Look up professional team contacts by name
    const names = [contactRes.data?.lawyer_name, contactRes.data?.accountant_name, contactRes.data?.executor_name, contactRes.data?.poa_name].filter(Boolean) as string[];
    if (names.length > 0) {
      const { data: matchedContacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, full_name")
        .in("full_name", names);
      const map: Record<string, { id: string; full_name: string } | null> = {};
      names.forEach((name) => {
        const match = matchedContacts?.find((c) => c.full_name === name) || null;
        map[name] = match ? { id: match.id, full_name: match.full_name } : null;
      });
      setProfessionalContacts(map);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  if (loading) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Loading...</p>
      </AppLayout>
    );
  }

  if (!contact) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Contact not found.</p>
      </AppLayout>
    );
  }

  const isStabilization = contact.governance_status === "stabilization";
  const quietStart = contact.quiet_period_start_date
    ? new Date(contact.quiet_period_start_date)
    : null;
  const quietEnd = quietStart ? addDays(quietStart, 90) : null;
  const daysElapsed = quietStart
    ? Math.min(differenceInDays(new Date(), quietStart), 90)
    : 0;
  const daysLeft = quietEnd
    ? Math.max(differenceInDays(quietEnd, new Date()), 0)
    : null;
  const progressPct = quietStart ? Math.min((daysElapsed / 90) * 100, 100) : 0;

  const resourceLinks = [
    { label: "SideDrawer", url: contact.sidedrawer_url, icon: Folder },
    { label: "Google Drive", url: contact.google_drive_url, icon: FolderOpen },
    { label: "Asana", url: contact.asana_url, icon: CheckSquare },
    { label: "IA Financial", url: contact.ia_financial_url, icon: ShieldCheck },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumbs items={[
          { label: "Dashboard", href: "/dashboard" },
          ...(familyName ? [{ label: familyName, href: "/families" }] : []),
          ...(householdLabel ? [{ label: householdLabel, href: "/families" }] : []),
          { label: "Contacts", href: "/contacts" },
          { label: `${contact.first_name} ${contact.last_name || ""}`.trim() },
        ]} />
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{contact.first_name} {contact.last_name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="text-xs uppercase">
                  {contact.fiduciary_entity}
                </Badge>
                <Badge
                  className={
                    isStabilization
                       ? "bg-sanctuary-green/20 text-sanctuary-green border-sanctuary-green/30"
                       : "bg-sanctuary-bronze/20 text-sanctuary-bronze border-sanctuary-bronze/30"
                  }
                >
                  {isStabilization ? "Stabilization Phase" : "Sovereign Phase"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PortalMagicLinkButton contactId={id!} />
            <Button
              variant="outline"
              onClick={() => navigate(`/contacts/${id}/edit`)}
            >
              Edit Contact
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete contact</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {contact.first_name} {contact.last_name} and all associated relationships. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      const { error } = await supabase.from("contacts").delete().eq("id", id!);
                      if (error) {
                        toast.error("Failed to delete contact.");
                      } else {
                        toast.success("Contact deleted.");
                        navigate("/contacts");
                      }
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Quiet Period Timer */}
            {isStabilization && quietStart && (
               <Card className="border-sanctuary-green/30">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="h-5 w-5 text-sanctuary-green" />
                    <h3 className="font-semibold">Quiet Period</h3>
                    <Badge className="ml-auto bg-sanctuary-green/10 text-sanctuary-green border-sanctuary-green/20">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Zero Sales Pressure
                    </Badge>
                  </div>
                  <Progress value={progressPct} className="mb-3 h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Started {format(quietStart, "MMM d, yyyy")}</span>
                    <span className="font-medium text-foreground">
                      {daysLeft !== null && daysLeft > 0
                        ? `${daysLeft} days remaining`
                        : "Quiet Period Complete"}
                    </span>
                    <span>Ends {quietEnd && format(quietEnd, "MMM d, yyyy")}</span>
                  </div>
                  {daysLeft === 0 && (
                    <div className="mt-4 rounded-md bg-sanctuary-bronze/10 p-3 text-center text-sm text-sanctuary-bronze">
                      <Shield className="mr-1 inline h-4 w-4" />
                      Ready for Charter Ratification
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="font-medium">{contact.email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="font-medium">{contact.phone || "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Address</dt>
                    <dd className="font-medium">{contact.address || "—"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Resources */}
            <div className="grid grid-cols-4 gap-2">
              {resourceLinks.map(({ label, url, icon: Icon }) => (
                <a
                  key={label}
                  href={url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors ${
                    url
                      ? "hover:bg-muted/50"
                      : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{label}</span>
                  {url && (
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  )}
                </a>
              ))}
            </div>
            <Tabs defaultValue="comms" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="comms" className="flex-1">Communications</TabsTrigger>
                <TabsTrigger value="assistant" className="flex-1">
                  <Bot className="mr-1.5 h-3.5 w-3.5" />
                  AI Assistant
                </TabsTrigger>
              </TabsList>
              <TabsContent value="comms" className="space-y-6 mt-4">
                <ContactCalendar contactEmail={contact.email} />
                <ContactEmails contactEmail={contact.email} />
              </TabsContent>
              <TabsContent value="assistant" className="space-y-4 mt-4">
                <SovereigntyAssistant
                  variant="embedded"
                  contactId={id}
                  contactContext={{
                    id: contact.id,
                    name: `${contact.first_name} ${contact.last_name || ""}`.trim(),
                    email: contact.email,
                    phone: contact.phone,
                    governance_status: contact.governance_status,
                    fiduciary_entity: contact.fiduciary_entity,
                    vineyard_ebitda: contact.vineyard_ebitda,
                    vineyard_operating_income: contact.vineyard_operating_income,
                    vineyard_balance_sheet_summary: contact.vineyard_balance_sheet_summary,
                    storehouses: storehouses.map((s) => ({
                      number: s.storehouse_number,
                      label: s.label,
                      asset_type: s.asset_type,
                      risk_cap: s.risk_cap,
                      charter_alignment: s.charter_alignment,
                    })),
                    quiet_period_start_date: contact.quiet_period_start_date,
                    asana_url: contact.asana_url,
                    google_drive_url: contact.google_drive_url,
                  }}
                />
                <AuditTrail contactId={id!} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Vineyard & Storehouses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">The Vineyard & Storehouses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* The Vineyard Container */}
                <AssetContainer
                  title="The Vineyard"
                  icon={<Grape className="h-3.5 w-3.5 text-sanctuary-green" />}
                  containerKey="vineyard"
                  contactId={id!}
                  accounts={vineyardAccounts.map((acc) => ({
                    id: acc.id,
                    name: acc.account_name,
                    type: acc.account_type,
                    currentValue: acc.current_value,
                    notes: acc.notes,
                    visibilityScope: acc.visibility_scope,
                    sourceTable: "vineyard_accounts" as const,
                  }))}
                  moveTargets={[
                    { label: "The Keep", key: "storehouse-1" },
                    { label: "The Armoury", key: "storehouse-2" },
                    { label: "The Granary", key: "storehouse-3" },
                    { label: "The Vault", key: "storehouse-4" },
                  ]}
                  onMoveAccount={async (account, targetKey) => {
                    const storehouseNum = parseInt(targetKey.split("-")[1]);
                    // Move: create storehouse record, delete vineyard record
                    const { error: insertErr } = await supabase.from("storehouses").insert({
                      contact_id: id,
                      storehouse_number: storehouseNum,
                      label: account.name,
                      current_value: account.currentValue,
                      notes: account.notes,
                      visibility_scope: account.visibilityScope,
                    } as any);
                    if (insertErr) { toast.error("Failed to move account."); return; }
                    await supabase.from("vineyard_accounts" as any).delete().eq("id", account.id);
                    toast.success(`Moved "${account.name}" to ${STOREHOUSE_NAMES[storehouseNum - 1]}.`);
                    fetchData();
                  }}
                  onRefresh={fetchData}
                  showAddForm={showAddAccount}
                  onAddAccount={() => setShowAddAccount(true)}
                  addFormContent={
                    <div className="mt-2 space-y-2 rounded-md border p-3">
                      <Input
                        placeholder="Account name (e.g. Fidelity Portfolio)"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <select
                          value={newAccountType}
                          onChange={(e) => setNewAccountType(e.target.value)}
                          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <option value="Portfolio">Portfolio</option>
                          <option value="Business Venture">Business Venture</option>
                          <option value="Real Estate">Real Estate</option>
                          <option value="Insurance">Insurance</option>
                          <option value="Retirement">Retirement</option>
                          <option value="Other">Other</option>
                        </select>
                        <Input
                          type="number"
                          placeholder="Value ($)"
                          value={newAccountValue}
                          onChange={(e) => setNewAccountValue(e.target.value)}
                          className="w-28"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!newAccountName.trim()}
                          onClick={async () => {
                            const { error } = await supabase.from("vineyard_accounts" as any).insert({
                              contact_id: id,
                              account_name: newAccountName.trim(),
                              account_type: newAccountType,
                              current_value: newAccountValue ? Number(newAccountValue) : null,
                            } as any);
                            if (error) {
                              toast.error("Failed to add account.");
                            } else {
                              toast.success("Account added.");
                              setNewAccountName("");
                              setNewAccountType("Portfolio");
                              setNewAccountValue("");
                              setShowAddAccount(false);
                              fetchData();
                            }
                          }}
                        >
                          Add
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddAccount(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  }
                />

                {/* Storehouse Containers */}
                {[1, 2, 3, 4].map((num) => {
                  const accounts = storehouses.filter((s) => s.storehouse_number === num);
                  const isPlaceholder = accounts.length === 0;
                  const storehouseName = STOREHOUSE_NAMES[num - 1];

                  const otherTargets: MoveTarget[] = [
                    { label: "The Vineyard", key: "vineyard" },
                    ...[1, 2, 3, 4]
                      .filter((n) => n !== num)
                      .map((n) => ({ label: STOREHOUSE_NAMES[n - 1], key: `storehouse-${n}` })),
                  ];

                  return (
                    <AssetContainer
                      key={num}
                      title={storehouseName}
                      icon={
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${isPlaceholder ? "bg-muted text-muted-foreground" : "bg-sanctuary-bronze/20 text-sanctuary-bronze"}`}>
                          {num}
                        </span>
                      }
                      containerKey={`storehouse-${num}`}
                      contactId={id!}
                      isPlaceholder={isPlaceholder}
                      accounts={accounts.map((sh) => ({
                        id: sh.id,
                        name: sh.asset_type || sh.label || "Account",
                        type: "",
                        currentValue: sh.current_value,
                        targetValue: sh.target_value,
                        notes: sh.notes,
                        visibilityScope: sh.visibility_scope,
                        charterAlignment: sh.charter_alignment,
                        sourceTable: "storehouses" as const,
                      }))}
                      moveTargets={otherTargets}
                      onMoveAccount={async (account, targetKey) => {
                        if (targetKey === "vineyard") {
                          // Move to vineyard: create vineyard record, delete storehouse record
                          const { error: insertErr } = await supabase.from("vineyard_accounts" as any).insert({
                            contact_id: id,
                            account_name: account.name,
                            account_type: account.type || "Portfolio",
                            current_value: account.currentValue,
                            notes: account.notes,
                            visibility_scope: account.visibilityScope,
                          } as any);
                          if (insertErr) { toast.error("Failed to move account."); return; }
                          await supabase.from("storehouses").delete().eq("id", account.id);
                          toast.success(`Moved "${account.name}" to The Vineyard.`);
                        } else {
                          // Move to another storehouse: update storehouse_number
                          const targetNum = parseInt(targetKey.split("-")[1]);
                          const { error } = await supabase
                            .from("storehouses")
                            .update({ storehouse_number: targetNum } as any)
                            .eq("id", account.id);
                          if (error) { toast.error("Failed to move account."); return; }
                          toast.success(`Moved "${account.name}" to ${STOREHOUSE_NAMES[targetNum - 1]}.`);
                        }
                        fetchData();
                      }}
                      onRefresh={fetchData}
                      onAddAccount={async () => {
                        const { error } = await supabase.from("storehouses").insert({
                          contact_id: id,
                          storehouse_number: num,
                          label: "",
                        } as any);
                        if (error) {
                          toast.error("Failed to add account.");
                        } else {
                          toast.success("Account added.");
                          fetchData();
                        }
                      }}
                      onConfigurePlaceholder={async () => {
                        const { error } = await supabase.from("storehouses").insert({
                          contact_id: id,
                          storehouse_number: num,
                          label: storehouseName,
                        } as any);
                        if (error) {
                          toast.error("Failed to create storehouse.");
                        } else {
                          toast.success("Storehouse created.");
                          fetchData();
                        }
                      }}
                    />
                  );
                })}
              </CardContent>
            </Card>


            {/* Household Members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Household Members</CardTitle>
              </CardHeader>
              <CardContent>
                {householdMembers.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {householdMembers.map((hm) => (
                      <li key={hm.id} className="flex items-center gap-1">
                        <Link
                          to={`/contacts/${hm.member_contact_id}`}
                          className="flex flex-1 items-center justify-between rounded-md bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
                        >
                          <span className="font-medium">{hm.contact ? `${(hm.contact as any).first_name} ${(hm.contact as any).last_name || ""}`.trim() : "Unknown"}</span>
                          {hm.relationship_label && (
                            <span className="text-xs text-muted-foreground">{hm.relationship_label}</span>
                          )}
                        </Link>
                        <button
                          onClick={async () => {
                            await supabase.from("household_relationships").delete().eq("id", hm.id);
                            toast.success("Removed.");
                            fetchData();
                          }}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No household members linked.
                  </p>
                )}
                <ContactLinker contactId={id!} excludeContactId={id} type="household" onLinked={fetchData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Family Members</CardTitle>
              </CardHeader>
              <CardContent>
                {familyMembers.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {familyMembers.map((fm) => (
                      <li key={fm.id} className="flex items-center gap-1">
                        <Link
                          to={`/contacts/${fm.member_contact_id}`}
                          className="flex flex-1 items-center justify-between rounded-md bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
                        >
                          <span className="font-medium">{fm.contact ? `${(fm.contact as any).first_name} ${(fm.contact as any).last_name || ""}`.trim() : "Unknown"}</span>
                          {fm.relationship_label && (
                            <span className="text-xs text-muted-foreground">{fm.relationship_label}</span>
                          )}
                        </Link>
                        <button
                          onClick={async () => {
                            await supabase.from("family_relationships").delete().eq("id", fm.id);
                            toast.success("Removed.");
                            fetchData();
                          }}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No family members linked.
                  </p>
                )}
                <ContactLinker contactId={id!} excludeContactId={id} type="family" onLinked={fetchData} labelPlaceholder="Relationship (e.g. Uncle)" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Professional Team</CardTitle>
              </CardHeader>
              <CardContent>
                {[
                  { role: "Lawyer", name: contact.lawyer_name, firm: contact.lawyer_firm },
                  { role: "Accountant", name: contact.accountant_name, firm: contact.accountant_firm },
                  { role: "Executor", name: contact.executor_name, firm: contact.executor_firm },
                  { role: "Power of Attorney", name: contact.poa_name, firm: contact.poa_firm },
                ].filter(({ name }) => name).length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {[
                      { role: "Lawyer", nameCol: "lawyer_name", firmCol: "lawyer_firm", name: contact.lawyer_name, firm: contact.lawyer_firm },
                      { role: "Accountant", nameCol: "accountant_name", firmCol: "accountant_firm", name: contact.accountant_name, firm: contact.accountant_firm },
                      { role: "Executor", nameCol: "executor_name", firmCol: "executor_firm", name: contact.executor_name, firm: contact.executor_firm },
                      { role: "Power of Attorney", nameCol: "poa_name", firmCol: "poa_firm", name: contact.poa_name, firm: contact.poa_firm },
                    ].map(({ role, nameCol, firmCol, name, firm }) => {
                      if (!name) return null;
                      const matched = professionalContacts[name];
                      return (
                        <li key={role} className="flex items-center gap-1">
                          <Link
                            to={matched ? `/contacts/${matched.id}` : `/contacts/new?full_name=${encodeURIComponent(name)}`}
                            className="flex flex-1 items-center justify-between rounded-md bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
                          >
                            <span className="font-medium flex items-center gap-1">
                              {name}{firm ? ` — ${firm}` : ""}
                              {!matched && <Plus className="h-3 w-3" />}
                            </span>
                            <span className="text-xs text-muted-foreground">{role}</span>
                          </Link>
                          <button
                            onClick={async () => {
                              await supabase.from("contacts").update({ [nameCol]: null, [firmCol]: null }).eq("id", id!);
                              toast.success(`${role} removed.`);
                              fetchData();
                            }}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No professionals linked.
                  </p>
                )}
                <ProfessionalLinker contactId={id!} contact={contact} onLinked={fetchData} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ContactDetail;

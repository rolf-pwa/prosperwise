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
  Users,
  Bell,
  BellOff,
  Landmark,
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
import { Grape, Building2 } from "lucide-react";
import { ContactTaskList } from "@/components/ContactTaskList";
import { HoldingTank } from "@/components/HoldingTank";

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
  first_name: string;
  last_name: string | null;
  family_role: string;
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
  const [corporateStakes, setCorporateStakes] = useState<Array<{
    corporation_id: string;
    corporation_name: string;
    corporation_type: string;
    ownership_percentage: number;
    share_class: string | null;
    role_title: string | null;
    total_assets: number;
    pro_rata: number;
    subsidiaries: Array<{
      child_id: string;
      child_name: string;
      child_type: string;
      parent_ownership_pct: number;
      child_total_assets: number;
      indirect_pro_rata: number;
    }>;
  }>>([]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [contactRes, storehouseRes, householdRes, familyRes, accountsRes] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("storehouses")
        .select("*")
        .eq("contact_id", id)
        .order("storehouse_number"),
      // Household members will be fetched after we know the household_id
      Promise.resolve({ data: [] }),
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
    setVineyardAccounts((accountsRes.data as any) || []);

    // Fetch household members (contacts sharing the same household_id)
    if (contactRes.data?.household_id) {
      const { data: hhMembers } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, family_role")
        .eq("household_id", contactRes.data.household_id)
        .neq("id", id)
        .order("first_name");
      setHouseholdMembers((hhMembers as any) || []);
    } else {
      setHouseholdMembers([]);
    }
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

    // Fetch corporate stakes for this contact
    const { data: shareholdings } = await supabase
      .from("shareholders")
      .select("corporation_id, ownership_percentage, share_class, role_title")
      .eq("contact_id", id)
      .eq("is_active", true);

    if (shareholdings && shareholdings.length > 0) {
      const corpIds = shareholdings.map((s) => s.corporation_id);
      const [corpsRes, assetsRes, subsRes] = await Promise.all([
        supabase.from("corporations").select("id, name, corporation_type").in("id", corpIds),
        supabase.from("corporate_vineyard_accounts").select("corporation_id, current_value").in("corporation_id", corpIds),
        supabase.from("corporate_shareholders").select("parent_corporation_id, child_corporation_id, ownership_percentage").in("parent_corporation_id", corpIds),
      ]);

      // Get subsidiary corp details & assets
      const childIds = (subsRes.data || []).map((s) => s.child_corporation_id);
      let childCorps: any[] = [];
      let childAssets: any[] = [];
      if (childIds.length > 0) {
        const [cc, ca] = await Promise.all([
          supabase.from("corporations").select("id, name, corporation_type").in("id", childIds),
          supabase.from("corporate_vineyard_accounts").select("corporation_id, current_value").in("corporation_id", childIds),
        ]);
        childCorps = cc.data || [];
        childAssets = ca.data || [];
      }

      const stakes = shareholdings.map((sh) => {
        const corp = (corpsRes.data || []).find((c) => c.id === sh.corporation_id);
        const totalAssets = (assetsRes.data || [])
          .filter((a) => a.corporation_id === sh.corporation_id)
          .reduce((sum, a) => sum + (Number(a.current_value) || 0), 0);
        const proRata = totalAssets * (sh.ownership_percentage / 100);

        const subs = (subsRes.data || [])
          .filter((s) => s.parent_corporation_id === sh.corporation_id)
          .map((s) => {
            const child = childCorps.find((c) => c.id === s.child_corporation_id);
            const childTotal = childAssets
              .filter((a) => a.corporation_id === s.child_corporation_id)
              .reduce((sum, a) => sum + (Number(a.current_value) || 0), 0);
            const indirectPct = (sh.ownership_percentage / 100) * (s.ownership_percentage / 100);
            return {
              child_id: s.child_corporation_id,
              child_name: child?.name || "Unknown",
              child_type: child?.corporation_type || "other",
              parent_ownership_pct: s.ownership_percentage,
              child_total_assets: childTotal,
              indirect_pro_rata: childTotal * indirectPct,
            };
          });

        return {
          corporation_id: sh.corporation_id,
          corporation_name: corp?.name || "Unknown",
          corporation_type: corp?.corporation_type || "other",
          ownership_percentage: sh.ownership_percentage,
          share_class: sh.share_class,
          role_title: sh.role_title,
          total_assets: totalAssets,
          pro_rata: proRata,
          subsidiaries: subs,
        };
      });
      setCorporateStakes(stakes);
    } else {
      setCorporateStakes([]);
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
    { label: "Just Wealth", url: (contact as any).just_wealth_url, icon: Landmark },
  ];

  // Derive current governance phase (1–5)
  const governancePhase = (() => {
    if (contact.governance_status === "sovereign") return 5;
    if (!isStabilization) return 4; // ratification
    if (quietStart && daysLeft !== null && daysLeft <= 0) return 4; // quiet complete → ready for ratification
    if (quietStart) return 3; // quiet period active
    // Check if any storehouses / vineyard exist → charter drafting
    if (storehouses.length > 0 || vineyardAccounts.length > 0) return 2;
    return 1; // discovery
  })();

  const PHASES = [
    { num: 1, label: "Discovery" },
    { num: 2, label: "Charter Drafting" },
    { num: 3, label: "Quiet Period" },
    { num: 4, label: "Ratification" },
    { num: 5, label: "Sovereign" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumbs items={[
          { label: "Dashboard", href: "/dashboard" },
          ...(familyName ? [{ label: familyName, href: "/families" }] : []),
          ...(householdLabel && contact.household_id ? [{ label: householdLabel, href: `/households/${contact.household_id}` }] : []),
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
              size="icon"
              title={contact.email_notifications_enabled !== false ? "Email notifications on" : "Email notifications off"}
              onClick={async () => {
                const newVal = contact.email_notifications_enabled === false;
                await supabase.from("contacts").update({ email_notifications_enabled: newVal }).eq("id", id);
                setContact((prev: any) => prev ? { ...prev, email_notifications_enabled: newVal } : prev);
                toast.success(newVal ? "Notifications enabled" : "Notifications disabled");
              }}
            >
              {contact.email_notifications_enabled !== false ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
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
              {resourceLinks.map(({ label, url, icon: Icon, internal }: any) => {
                if (internal && url) {
                  return (
                    <Link
                      key={label}
                      to={url}
                      className="flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors hover:bg-muted/50"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{label}</span>
                    </Link>
                  );
                }
                return (
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
                );
              })}
            </div>
            {/* Tasks */}
            <ContactTaskList asanaUrl={contact.asana_url} contactId={contact.id} householdMembers={householdMembers} />

            <Tabs defaultValue="comms" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="comms" className="flex-1">Communications</TabsTrigger>
                <TabsTrigger value="assistant" className="flex-1">
                  <Bot className="mr-1.5 h-3.5 w-3.5" />
                  AI Assistant
                </TabsTrigger>
              </TabsList>
              <TabsContent value="comms" className="space-y-6 mt-4">
                <ContactCalendar contactEmail={contact.email} contactName={contact.full_name} />
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
            {/* Family Link */}
            {familyName && contact.family_id && (
              <Link
                to="/families"
                className="flex items-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
              >
                <Users className="h-4 w-4 text-sanctuary-bronze" />
                <span>{familyName}</span>
                <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
              </Link>
            )}
            {/* Household Members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Household Members</CardTitle>
              </CardHeader>
              <CardContent>
                {householdMembers.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {householdMembers.map((hm) => (
                      <li key={hm.id}>
                        <Link
                          to={`/contacts/${hm.id}`}
                          className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
                        >
                          <span className="font-medium">{`${hm.first_name} ${hm.last_name || ""}`.trim()}</span>
                          <span className="text-xs text-muted-foreground capitalize">{hm.family_role.replace(/_/g, " ")}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No household members.
                  </p>
                )}
              </CardContent>
            </Card>
            
            {/* Holding Tank */}
            <HoldingTank contactId={id!} onAccountMoved={() => fetchData()} />

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

                {/* Corporate Stakes inside Vineyard */}
                {corporateStakes.length > 0 && (
                  <div className="rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-sanctuary-bronze" />
                        <h4 className="text-xs font-semibold uppercase tracking-wider">Corporate Holdings</h4>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        ${corporateStakes.reduce((sum, s) => {
                          const indirect = s.subsidiaries.reduce((si, sub) => si + sub.indirect_pro_rata, 0);
                          return sum + s.pro_rata + indirect;
                        }, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2 space-y-1">
                      {corporateStakes.map((stake) => {
                        const totalIndirect = stake.subsidiaries.reduce((s, sub) => s + sub.indirect_pro_rata, 0);
                        const totalStake = stake.pro_rata + totalIndirect;
                        return (
                          <div key={stake.corporation_id} className="rounded-md bg-muted/40 px-3 py-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Link
                                to={`/corporations/${stake.corporation_id}`}
                                className="font-medium text-sm hover:underline flex items-center gap-1.5"
                              >
                                {stake.corporation_name}
                                <Badge variant="outline" className="text-[9px] uppercase">{stake.corporation_type}</Badge>
                              </Link>
                              <span className="text-xs font-medium tabular-nums">${totalStake.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>{stake.ownership_percentage}% {stake.share_class || "Common"}</span>
                              {stake.role_title && <span>· {stake.role_title}</span>}
                              <span className="ml-auto">Direct: ${stake.pro_rata.toLocaleString()}</span>
                            </div>
                            {stake.subsidiaries.map((sub) => (
                              <div key={sub.child_id} className="flex justify-between text-[10px] pl-3 border-l-2 border-border">
                                <Link to={`/corporations/${sub.child_id}`} className="text-muted-foreground hover:underline">
                                  via {sub.child_name} ({stake.ownership_percentage}% × {sub.parent_ownership_pct}%)
                                </Link>
                                <span className="font-medium">${sub.indirect_pro_rata.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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

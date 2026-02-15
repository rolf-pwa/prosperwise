import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

interface Storehouse {
  id: string;
  storehouse_number: number;
  label: string;
  asset_type: string | null;
  risk_cap: string | null;
  charter_alignment: string;
  notes: string | null;
}

interface HouseholdMember {
  id: string;
  member_contact_id: string;
  relationship_label: string | null;
  contact: { id: string; full_name: string } | null;
}

const STOREHOUSE_LABELS = [
  "Storehouse I — Foundation",
  "Storehouse II — Growth",
  "Storehouse III — Legacy",
  "Storehouse IV — Reserve",
];

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<any>(null);
  const [storehouses, setStorehouses] = useState<Storehouse[]>([]);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [familyMembers, setFamilyMembers] = useState<HouseholdMember[]>([]);
  const [professionalContacts, setProfessionalContacts] = useState<Record<string, { id: string; full_name: string } | null>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [contactRes, storehouseRes, householdRes, familyRes] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("storehouses")
        .select("*")
        .eq("contact_id", id)
        .order("storehouse_number"),
      supabase
        .from("household_relationships")
        .select("id, member_contact_id, relationship_label, contact:contacts!household_relationships_member_contact_id_fkey(id, full_name)")
        .eq("contact_id", id),
      supabase
        .from("family_relationships")
        .select("id, member_contact_id, relationship_label, contact:contacts!family_relationships_member_contact_id_fkey(id, full_name)")
        .eq("contact_id", id),
    ]);
    setContact(contactRes.data);
    setStorehouses(storehouseRes.data || []);
    setHouseholdMembers((householdRes.data as any) || []);
    setFamilyMembers((familyRes.data as any) || []);

    // Look up professional team contacts by name
    const names = [contactRes.data?.lawyer_name, contactRes.data?.accountant_name, contactRes.data?.executor_name, contactRes.data?.poa_name].filter(Boolean) as string[];
    if (names.length > 0) {
      const { data: matchedContacts } = await supabase
        .from("contacts")
        .select("id, full_name")
        .in("full_name", names);
      const map: Record<string, { id: string; full_name: string } | null> = {};
      names.forEach((name) => {
        const match = matchedContacts?.find((c) => c.full_name === name) || null;
        map[name] = match;
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
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{contact.full_name}</h1>
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
                    This will permanently delete {contact.full_name} and all associated relationships. This action cannot be undone.
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

            {/* Email & Calendar */}
            <ContactCalendar contactEmail={contact.email} />
            <ContactEmails contactEmail={contact.email} />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Vineyard & Storehouses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">The Vineyard & Storehouses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Vineyard metrics */}
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entity Data</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">EBITDA</dt>
                      <dd className="font-semibold">
                        {contact.vineyard_ebitda != null
                          ? `$${Number(contact.vineyard_ebitda).toLocaleString()}`
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Operating Income</dt>
                      <dd className="font-semibold">
                        {contact.vineyard_operating_income != null
                          ? `$${Number(contact.vineyard_operating_income).toLocaleString()}`
                          : "—"}
                      </dd>
                    </div>
                    {contact.vineyard_balance_sheet_summary && (
                      <div>
                        <dt className="text-muted-foreground">Balance Sheet</dt>
                        <dd className="mt-0.5 font-medium">{contact.vineyard_balance_sheet_summary}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Storehouses */}
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Liquidity Vessels</h4>
                  <Accordion type="multiple" className="w-full">
                    {[1, 2, 3, 4].map((num) => {
                      const sh = storehouses.find(
                        (s) => s.storehouse_number === num
                      );
                      return (
                        <AccordionItem key={num} value={`sh-${num}`}>
                          <AccordionTrigger className="hover:no-underline py-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {num}
                              </span>
                              <span className="text-sm">{STOREHOUSE_LABELS[num - 1]}</span>
                              {sh && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    sh.charter_alignment === "aligned"
                                      ? "border-green-500/30 text-green-600"
                                      : sh.charter_alignment === "misaligned"
                                      ? "border-destructive/30 text-destructive"
                                      : "border-muted-foreground/30 text-muted-foreground"
                                  }`}
                                >
                                  {sh.charter_alignment.replace("_", " ")}
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {sh ? (
                              <dl className="space-y-1 text-sm pl-8">
                                <div>
                                  <dt className="text-muted-foreground text-xs">Asset Type</dt>
                                  <dd className="font-medium">{sh.asset_type || "—"}</dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground text-xs">Risk Cap</dt>
                                  <dd className="font-medium">{sh.risk_cap || "—"}</dd>
                                </div>
                                {sh.notes && (
                                  <div>
                                    <dt className="text-muted-foreground text-xs">Notes</dt>
                                    <dd>{sh.notes}</dd>
                                  </div>
                                )}
                              </dl>
                            ) : (
                              <p className="pl-8 text-sm text-muted-foreground">
                                Not configured yet.
                              </p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resourceLinks.map(({ label, url, icon: Icon }) => (
                  <a
                    key={label}
                    href={url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
                      url
                        ? "hover:bg-muted/50"
                        : "cursor-not-allowed opacity-50"
                    }`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 font-medium">{label}</span>
                    {url && (
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    )}
                  </a>
                ))}
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
                      <li key={hm.id}>
                        <Link
                          to={`/contacts/${hm.member_contact_id}`}
                          className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
                        >
                          <span className="font-medium">{hm.contact?.full_name || "Unknown"}</span>
                          {hm.relationship_label && (
                            <span className="text-xs text-muted-foreground">{hm.relationship_label}</span>
                          )}
                        </Link>
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
                      <li key={fm.id}>
                        <Link
                          to={`/contacts/${fm.member_contact_id}`}
                          className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
                        >
                          <span className="font-medium">{fm.contact?.full_name || "Unknown"}</span>
                          {fm.relationship_label && (
                            <span className="text-xs text-muted-foreground">{fm.relationship_label}</span>
                          )}
                        </Link>
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
                      { role: "Lawyer", name: contact.lawyer_name, firm: contact.lawyer_firm },
                      { role: "Accountant", name: contact.accountant_name, firm: contact.accountant_firm },
                      { role: "Executor", name: contact.executor_name, firm: contact.executor_firm },
                      { role: "Power of Attorney", name: contact.poa_name, firm: contact.poa_firm },
                    ].map(({ role, name, firm }) => {
                      if (!name) return null;
                      const matched = professionalContacts[name];
                      return (
                        <li key={role}>
                          <Link
                            to={matched ? `/contacts/${matched.id}` : `/contacts/new?full_name=${encodeURIComponent(name)}`}
                            className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
                          >
                            <span className="font-medium flex items-center gap-1">
                              {name}{firm ? ` — ${firm}` : ""}
                              {!matched && <Plus className="h-3 w-3" />}
                            </span>
                            <span className="text-xs text-muted-foreground">{role}</span>
                          </Link>
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

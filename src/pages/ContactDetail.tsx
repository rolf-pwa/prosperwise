import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { differenceInDays, addDays, format } from "date-fns";

interface Storehouse {
  id: string;
  storehouse_number: number;
  label: string;
  asset_type: string | null;
  risk_cap: string | null;
  charter_alignment: string;
  notes: string | null;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function fetch() {
      const [contactRes, storehouseRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", id).single(),
        supabase
          .from("storehouses")
          .select("*")
          .eq("contact_id", id)
          .order("storehouse_number"),
      ]);
      setContact(contactRes.data);
      setStorehouses(storehouseRes.data || []);
      setLoading(false);
    }
    fetch();
  }, [id]);

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
          <Button
            variant="outline"
            onClick={() => navigate(`/contacts/${id}/edit`)}
          >
            Edit Contact
          </Button>
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

            {/* Professional Team */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Professional Team</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Lawyer</dt>
                    <dd className="font-medium">
                      {contact.lawyer_name
                        ? `${contact.lawyer_name}${contact.lawyer_firm ? ` — ${contact.lawyer_firm}` : ""}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Accountant</dt>
                    <dd className="font-medium">
                      {contact.accountant_name
                        ? `${contact.accountant_name}${contact.accountant_firm ? ` — ${contact.accountant_firm}` : ""}`
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* The Vineyard */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">The Vineyard — Entity Data</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">EBITDA</dt>
                    <dd className="text-lg font-semibold">
                      {contact.vineyard_ebitda != null
                        ? `$${Number(contact.vineyard_ebitda).toLocaleString()}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Operating Income</dt>
                    <dd className="text-lg font-semibold">
                      {contact.vineyard_operating_income != null
                        ? `$${Number(contact.vineyard_operating_income).toLocaleString()}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="col-span-3">
                    <dt className="text-muted-foreground">Balance Sheet Summary</dt>
                    <dd className="font-medium">
                      {contact.vineyard_balance_sheet_summary || "—"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* The 4 Storehouses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  The 4 Storehouses — Liquidity Vessels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {[1, 2, 3, 4].map((num) => {
                    const sh = storehouses.find(
                      (s) => s.storehouse_number === num
                    );
                    return (
                      <AccordionItem key={num} value={`sh-${num}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {num}
                            </span>
                            <span>{STOREHOUSE_LABELS[num - 1]}</span>
                            {sh && (
                              <Badge
                                variant="outline"
                                className={
                                  sh.charter_alignment === "aligned"
                                    ? "border-green-500/30 text-green-600"
                                    : sh.charter_alignment === "misaligned"
                                    ? "border-destructive/30 text-destructive"
                                    : "border-muted-foreground/30 text-muted-foreground"
                                }
                              >
                                {sh.charter_alignment.replace("_", " ")}
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {sh ? (
                            <dl className="grid grid-cols-2 gap-3 text-sm pl-10">
                              <div>
                                <dt className="text-muted-foreground">
                                  Asset Type
                                </dt>
                                <dd className="font-medium">
                                  {sh.asset_type || "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">
                                  Risk Cap
                                </dt>
                                <dd className="font-medium">
                                  {sh.risk_cap || "—"}
                                </dd>
                              </div>
                              {sh.notes && (
                                <div className="col-span-2">
                                  <dt className="text-muted-foreground">
                                    Notes
                                  </dt>
                                  <dd>{sh.notes}</dd>
                                </div>
                              )}
                            </dl>
                          ) : (
                            <p className="pl-10 text-sm text-muted-foreground">
                              Not configured yet.
                            </p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </div>

          {/* Resource Sidebar */}
          <div className="space-y-4">
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
                {contact.household_members &&
                Array.isArray(contact.household_members) &&
                contact.household_members.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {contact.household_members.map((member: any, i: number) => (
                      <li key={i} className="rounded-md bg-muted/50 px-3 py-2">
                        {typeof member === "string" ? member : member.name || JSON.stringify(member)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No household members listed.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ContactDetail;

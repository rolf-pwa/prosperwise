import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { Progress } from "@/components/ui/progress";
import {
  Home,
  Search,
  User,
  Crown,
  Shield,
  Baby,
  Loader2,
  Grape,
  Landmark,
  Castle,
  Sword,
  Wheat,
  Lock,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const ROLE_ICONS: Record<string, typeof Crown> = {
  head_of_family: Crown,
  spouse: Shield,
  beneficiary: User,
  minor: Baby,
};

const ROLE_LABELS: Record<string, string> = {
  head_of_family: "Head of Family",
  spouse: "Spouse",
  beneficiary: "Beneficiary",
  minor: "Minor",
};

const STOREHOUSE_CONFIG = [
  { num: 1, name: "The Keep", subtitle: "Liquidity Reserve", icon: Castle },
  { num: 2, name: "The Armoury", subtitle: "Strategic Reserve", icon: Sword },
  { num: 3, name: "The Granary", subtitle: "Philanthropic Trust", icon: Wheat },
  { num: 4, name: "The Vault", subtitle: "Legacy Trust", icon: Lock },
];

interface HouseholdData {
  id: string;
  label: string;
  address: string | null;
  family_id: string;
  familyName: string;
  members: {
    id: string;
    first_name: string;
    last_name: string | null;
    family_role: string;
    email: string | null;
  }[];
  vineyardAccounts: any[];
  storehouses: any[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const Households = () => {
  const [households, setHouseholds] = useState<HouseholdData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const [
      { data: hhData },
      { data: families },
      { data: contacts },
      { data: vineyard },
      { data: storehouses },
    ] = await Promise.all([
      supabase.from("households").select("*").order("label"),
      supabase.from("families").select("id, name"),
      supabase.from("contacts").select("id, first_name, last_name, family_role, email, household_id"),
      supabase.from("vineyard_accounts").select("*"),
      supabase.from("storehouses").select("*"),
    ]);

    const familyMap = new Map((families || []).map((f: any) => [f.id, f.name]));

    const result: HouseholdData[] = (hhData || []).map((hh: any) => {
      const members = (contacts || []).filter((c: any) => c.household_id === hh.id);
      const memberIds = new Set(members.map((m: any) => m.id));
      return {
        id: hh.id,
        label: hh.label,
        address: hh.address,
        family_id: hh.family_id,
        familyName: familyMap.get(hh.family_id) || "Unknown",
        members,
        vineyardAccounts: (vineyard || []).filter((v: any) => memberIds.has(v.contact_id)),
        storehouses: (storehouses || []).filter((s: any) => memberIds.has(s.contact_id)),
      };
    });

    setHouseholds(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = households.filter(
    (hh) =>
      hh.label.toLowerCase().includes(search.toLowerCase()) ||
      hh.familyName.toLowerCase().includes(search.toLowerCase()) ||
      hh.members.some((m) =>
        `${m.first_name} ${m.last_name || ""}`.toLowerCase().includes(search.toLowerCase())
      )
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Households" },
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Households</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {households.length} household{households.length !== 1 ? "s" : ""} across all families
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search households, families, or members…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">No households found.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((hh) => {
              const totalVineyard = hh.vineyardAccounts.reduce(
                (sum, a) => sum + (Number(a.current_value) || 0),
                0
              );
              const totalStorehouses = hh.storehouses.reduce(
                (sum, s) => sum + (Number(s.current_value) || 0),
                0
              );
              const isOpen = expanded.has(hh.id);

              return (
                <Collapsible
                  key={hh.id}
                  open={isOpen}
                  onOpenChange={() => toggleExpand(hh.id)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Home className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg">{hh.label}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {hh.familyName} Family
                              {hh.address && ` · ${hh.address}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {formatCurrency(totalVineyard + totalStorehouses)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Total Assets</p>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                              {hh.members.length} member{hh.members.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="space-y-6 border-t pt-6">
                        {/* Members */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Members
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {hh.members.map((m) => {
                              const RoleIcon = ROLE_ICONS[m.family_role] || User;
                              return (
                                <Link
                                  key={m.id}
                                  to={`/contacts/${m.id}`}
                                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 hover:bg-muted/60 transition-colors"
                                >
                                  <RoleIcon className="h-4 w-4 text-primary shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {m.first_name} {m.last_name || ""}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {ROLE_LABELS[m.family_role] || m.family_role}
                                    </p>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>

                        {/* Vineyard */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                              <Grape className="h-4 w-4 text-primary" />
                            </div>
                            <h3 className="text-sm font-semibold">The Vineyard</h3>
                            <span className="ml-auto text-lg font-bold text-primary">
                              {formatCurrency(totalVineyard)}
                            </span>
                          </div>
                          {hh.vineyardAccounts.length > 0 ? (
                            <div className="space-y-1.5 pl-11">
                              {(() => {
                                const byType: Record<string, { accounts: any[]; total: number }> = {};
                                hh.vineyardAccounts.forEach((a) => {
                                  const t = a.account_type || "Other";
                                  if (!byType[t]) byType[t] = { accounts: [], total: 0 };
                                  byType[t].accounts.push(a);
                                  byType[t].total += Number(a.current_value) || 0;
                                });
                                return Object.entries(byType).map(([type, { accounts, total }]) => (
                                  <div key={type} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="font-medium text-foreground">{type}</span>
                                      <span className="text-foreground font-semibold">{formatCurrency(total)}</span>
                                    </div>
                                    {accounts.map((acc) => (
                                      <div
                                        key={acc.id}
                                        className="flex items-center justify-between rounded-md bg-muted/50 border border-border px-3 py-2"
                                      >
                                        <span className="text-sm text-foreground/80">{acc.account_name}</span>
                                        <span className="text-sm font-medium text-foreground">
                                          {formatCurrency(Number(acc.current_value) || 0)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ));
                              })()}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground pl-11">No vineyard accounts configured.</p>
                          )}
                        </div>

                        {/* Storehouses */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10">
                              <Landmark className="h-4 w-4 text-accent" />
                            </div>
                            <h3 className="text-sm font-semibold">The Storehouses</h3>
                            <span className="ml-auto text-lg font-bold text-accent">
                              {formatCurrency(totalStorehouses)}
                            </span>
                          </div>
                          <div className="space-y-3 pl-11">
                            {STOREHOUSE_CONFIG.map(({ num, name, subtitle, icon: Icon }) => {
                              const accounts = hh.storehouses.filter((s) => s.storehouse_number === num);
                              const total = accounts.reduce((sum, s) => sum + (Number(s.current_value) || 0), 0);
                              const targetTotal = accounts.reduce((sum, s) => sum + (Number(s.target_value) || 0), 0);
                              const pct = targetTotal > 0 ? Math.min((total / targetTotal) * 100, 100) : 0;

                              return (
                                <div key={num} className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-accent" />
                                      <span className="text-sm font-medium">{name}</span>
                                      <span className="text-xs text-muted-foreground">· {subtitle}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground">
                                      {formatCurrency(total)}
                                    </span>
                                  </div>
                                  {accounts.length > 0 ? (
                                    <>
                                      {targetTotal > 0 && (
                                        <div className="space-y-1">
                                          <Progress value={pct} className="h-1.5 bg-muted [&>div]:bg-accent" />
                                          <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>{Math.round(pct)}% funded</span>
                                            <span>Target: {formatCurrency(targetTotal)}</span>
                                          </div>
                                        </div>
                                      )}
                                      {accounts.map((acc: any) => (
                                        <div
                                          key={acc.id}
                                          className="flex items-center justify-between rounded-md bg-muted/50 border border-border px-3 py-2"
                                        >
                                          <span className="text-sm text-foreground/80">
                                            {acc.label || acc.asset_type || acc.notes || "Account"}
                                          </span>
                                          <span className="text-sm font-medium text-foreground">
                                            {formatCurrency(Number(acc.current_value) || 0)}
                                          </span>
                                        </div>
                                      ))}
                                    </>
                                  ) : (
                                    <p className="text-[11px] text-muted-foreground">No accounts configured</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Households;

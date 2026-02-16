import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Grape, Landmark, Castle, Sword, Wheat, Lock, Users, Home } from "lucide-react";

const STOREHOUSE_CONFIG = [
  { num: 1, name: "The Keep", subtitle: "Liquidity Reserve", icon: Castle },
  { num: 2, name: "The Armoury", subtitle: "Strategic Reserve", icon: Sword },
  { num: 3, name: "The Granary", subtitle: "Philanthropic Trust", icon: Wheat },
  { num: 4, name: "The Vault", subtitle: "Legacy Trust", icon: Lock },
];

const ROLE_LABELS: Record<string, string> = {
  head_of_family: "Head of Family",
  spouse: "Spouse",
  beneficiary: "Beneficiary",
  minor: "Minor",
};

interface Props {
  vineyardAccounts: any[];
  storehouses: any[];
  contact: any;
  family?: any | null;
  household?: any | null;
  householdMembers?: any[];
}

export function PortalTerritory({ vineyardAccounts, storehouses, contact, family, household, householdMembers = [] }: Props) {
  // Filter: show family_shared and household_shared to portal users; mask private
  const visibleAccounts = vineyardAccounts.filter(
    (a: any) => a.visibility_scope !== "private"
  );
  const privateAccountCount = vineyardAccounts.length - visibleAccounts.length;

  const totalVineyard = visibleAccounts.reduce(
    (sum: number, a: any) => sum + (Number(a.current_value) || 0),
    0
  );

  const byType: Record<string, { accounts: any[]; total: number }> = {};
  visibleAccounts.forEach((a: any) => {
    const t = a.account_type || "Other";
    if (!byType[t]) byType[t] = { accounts: [], total: 0 };
    byType[t].accounts.push(a);
    byType[t].total += Number(a.current_value) || 0;
  });

  const visibleStorehouses = storehouses.filter(
    (s: any) => s.visibility_scope !== "private"
  );

  return (
    <div className="space-y-6">
      {/* Family & Household Context */}
      {(family || household || householdMembers.length > 0) && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Home className="h-5 w-5 text-accent" />
              </div>
              <div>
                {family && (
                  <h3 className="font-semibold text-foreground font-serif">{family.name}</h3>
                )}
                <p className="text-xs text-muted-foreground">
                  {household?.label ? `${household.label} Household` : ""}
                  {household?.address ? ` · ${household.address}` : ""}
                </p>
              </div>
              {contact.family_role && (
                <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {ROLE_LABELS[contact.family_role] || contact.family_role}
                </span>
              )}
            </div>

            {householdMembers.length > 0 && (
              <div className="border-t border-border pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Household Members</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {householdMembers.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 border border-border">
                      <span className="text-sm text-foreground">{m.first_name} {m.last_name || ""}</span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_LABELS[m.family_role] || m.family_role}
                        {m.is_minor && " · Minor"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vineyard Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Grape className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">The Vineyard</CardTitle>
              <p className="text-xs text-muted-foreground">Total Asset Portfolio</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-primary">
                ${totalVineyard.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Value</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(byType).length > 0 ? (
            Object.entries(byType).map(([type, { accounts, total }]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-foreground">{type}</h4>
                  <span className="text-sm font-semibold text-foreground">
                    ${total.toLocaleString()}
                  </span>
                </div>
                {accounts.map((acc: any) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 border border-border"
                  >
                    <span className="text-sm text-foreground/80">{acc.account_name}</span>
                    <span className="text-sm font-medium text-foreground">
                      ${(Number(acc.current_value) || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No accounts have been configured yet.</p>
          )}
          {privateAccountCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-muted px-4 py-3 bg-muted/30">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                {privateAccountCount} account{privateAccountCount !== 1 ? "s" : ""} protected by Governance Protocol
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storehouses */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Landmark className="h-5 w-5 text-accent" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">The Storehouses</CardTitle>
              <p className="text-xs text-muted-foreground">Strategic Asset Allocation</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-accent">
                ${visibleStorehouses.reduce((sum: number, s: any) => sum + (Number(s.current_value) || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Value</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {STOREHOUSE_CONFIG.map(({ num, name, subtitle, icon: Icon }) => {
            const accounts = visibleStorehouses.filter((s: any) => s.storehouse_number === num);
            const privateAccounts = storehouses.filter((s: any) => s.storehouse_number === num && s.visibility_scope === "private");
            const total = accounts.reduce((sum: number, s: any) => sum + (Number(s.current_value) || 0), 0);
            const targetTotal = accounts.reduce((sum: number, s: any) => sum + (Number(s.target_value) || 0), 0);
            const pct = targetTotal > 0 ? Math.min((total / targetTotal) * 100, 100) : 0;

            return (
              <div key={num} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-accent" />
                    <h4 className="text-sm font-medium text-foreground">{name}</h4>
                    <span className="text-xs text-muted-foreground">· {subtitle}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    ${total.toLocaleString()}
                  </span>
                </div>
                {accounts.length > 0 ? (
                  <>
                    {targetTotal > 0 && (
                      <div className="space-y-1">
                        <Progress value={pct} className="h-1.5 bg-muted [&>div]:bg-accent" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{Math.round(pct)}% funded</span>
                          <span>Target: ${targetTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {accounts.map((acc: any) => {
                      const accCurrent = Number(acc.current_value) || 0;
                      return (
                        <div
                          key={acc.id}
                          className="rounded-lg bg-muted/50 px-4 py-2.5 border border-border"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-sm text-foreground/80">{acc.asset_type || acc.notes || "Account"}</span>
                              {acc.charter_alignment && (
                                <span className={`text-xs mt-0.5 ${
                                  acc.charter_alignment === "aligned"
                                    ? "text-primary"
                                    : acc.charter_alignment === "misaligned"
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                                }`}>
                                  {acc.charter_alignment === "aligned" ? "Charter Aligned" : acc.charter_alignment === "misaligned" ? "Misaligned" : "Pending Review"}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              ${accCurrent.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : privateAccounts.length > 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-2.5 border border-border text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Value Protected by Governance Protocol</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pl-6">No accounts configured</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

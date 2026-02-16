import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Grape, Landmark, Shield, Heart, Castle, Sword, Wheat, Lock } from "lucide-react";

const STOREHOUSE_CONFIG = [
  { num: 1, name: "The Keep", subtitle: "Liquidity Reserve", icon: Castle },
  { num: 2, name: "The Armoury", subtitle: "Strategic Reserve", icon: Sword },
  { num: 3, name: "The Granary", subtitle: "Philanthropic Trust", icon: Wheat },
  { num: 4, name: "The Vault", subtitle: "Legacy Trust", icon: Lock },
];

interface Props {
  vineyardAccounts: any[];
  storehouses: any[];
  contact: any;
}

export function PortalTerritory({ vineyardAccounts, storehouses, contact }: Props) {
  const totalVineyard = vineyardAccounts.reduce(
    (sum: number, a: any) => sum + (Number(a.current_value) || 0),
    0
  );

  // Group accounts by type
  const byType: Record<string, { accounts: any[]; total: number }> = {};
  vineyardAccounts.forEach((a: any) => {
    const t = a.account_type || "Other";
    if (!byType[t]) byType[t] = { accounts: [], total: 0 };
    byType[t].accounts.push(a);
    byType[t].total += Number(a.current_value) || 0;
  });

  return (
    <div className="space-y-6">
      {/* Vineyard Overview */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Grape className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-slate-100 font-serif">The Vineyard</CardTitle>
              <p className="text-xs text-slate-500">Total Asset Portfolio</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-emerald-400">
                ${totalVineyard.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">Total Value</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(byType).length > 0 ? (
            Object.entries(byType).map(([type, { accounts, total }]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-300">{type}</h4>
                  <span className="text-sm font-semibold text-slate-200">
                    ${total.toLocaleString()}
                  </span>
                </div>
                {accounts.map((acc: any) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between rounded-lg bg-slate-800/50 px-4 py-2.5 border border-slate-700/50"
                  >
                    <span className="text-sm text-slate-300">{acc.account_name}</span>
                    <span className="text-sm font-medium text-slate-200">
                      ${(Number(acc.current_value) || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No accounts have been configured yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Storehouses */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="h-5 w-5 text-sanctuary-bronze" />
          <h2 className="text-lg font-semibold text-slate-100 font-serif">The Storehouses</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {STOREHOUSE_CONFIG.map(({ num, name, subtitle, icon: Icon }) => {
            const sh = storehouses.find((s: any) => s.storehouse_number === num);
            const current = Number(sh?.current_value) || 0;
            const target = Number(sh?.target_value) || 0;
            const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

            return (
              <Card key={num} className="bg-slate-900 border-slate-800">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sanctuary-bronze/10 shrink-0">
                      <Icon className="h-5 w-5 text-sanctuary-bronze" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-100">{name}</h3>
                      <p className="text-xs text-slate-500">{subtitle}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Current</span>
                      <span className="font-semibold text-slate-200">
                        ${current.toLocaleString()}
                      </span>
                    </div>
                    {target > 0 && (
                      <>
                        <Progress
                          value={pct}
                          className="h-2 bg-slate-800 [&>div]:bg-sanctuary-bronze"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{Math.round(pct)}% funded</span>
                          <span>Target: ${target.toLocaleString()}</span>
                        </div>
                      </>
                    )}

                    {sh?.charter_alignment && (
                      <div className={`text-xs rounded-full px-2 py-0.5 w-fit ${
                        sh.charter_alignment === "aligned"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : sh.charter_alignment === "misaligned"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-slate-700 text-slate-400"
                      }`}>
                        {sh.charter_alignment === "aligned" ? "Charter Aligned" : sh.charter_alignment === "misaligned" ? "Misaligned" : "Pending Review"}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

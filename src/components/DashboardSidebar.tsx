import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Home, ShieldCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalAssets: number;
  totalHouseholds: number;
  sovereignCount: number;
  stabilizationCount: number;
}

export function DashboardSidebar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Fetch families for asset totals and governance counts
        const { data: families } = await supabase
          .from("families")
          .select("id, total_family_assets");

        const totalAssets = (families || []).reduce(
          (sum, f) => sum + (Number(f.total_family_assets) || 0),
          0
        );

        // Fetch all households
        const { count: totalHouseholds } = await supabase
          .from("households")
          .select("id", { count: "exact", head: true });

        // Count sovereign vs stabilization by checking contacts with governance_status
        const { data: contacts } = await supabase
          .from("contacts")
          .select("household_id, governance_status")
          .eq("family_role", "head_of_family")
          .not("household_id", "is", null);

        const householdStatusMap = new Map<string, string>();
        for (const c of contacts || []) {
          if (c.household_id) {
            householdStatusMap.set(c.household_id, c.governance_status);
          }
        }

        const sovereignCount = Array.from(householdStatusMap.values()).filter(
          (s) => s === "sovereign"
        ).length;
        const stabilizationCount = Array.from(householdStatusMap.values()).filter(
          (s) => s === "stabilization"
        ).length;

        setStats({
          totalAssets,
          totalHouseholds: totalHouseholds ?? 0,
          sovereignCount,
          stabilizationCount,
        });
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Total Assets */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Assets Under Governance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(stats.totalAssets)}
          </p>
        </CardContent>
      </Card>

      {/* Household Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Home className="h-4 w-4" />
            Households
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold text-foreground">
              {stats.totalHouseholds}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-sanctuary-green" />
              Sovereign
            </span>
            <span className="text-sm font-semibold text-foreground">
              {stats.sovereignCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-sanctuary-bronze" />
              Stabilization
            </span>
            <span className="text-sm font-semibold text-foreground">
              {stats.stabilizationCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

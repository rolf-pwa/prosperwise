import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Home, ShieldCheck, Clock, Anchor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Stats {
  totalAssets: number;
  totalHouseholds: number;
  sovereignCount: number;
  stabilizationCount: number;
  holdingTankTotal: number;
  holdingTankCount: number;
}

export function DashboardSidebar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data: families } = await supabase
          .from("families")
          .select("id, total_family_assets");

        const totalAssets = (families || []).reduce(
          (sum, f) => sum + (Number(f.total_family_assets) || 0),
          0
        );

        const { count: totalHouseholds } = await supabase
          .from("households")
          .select("id", { count: "exact", head: true });

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

        // Holding tank summary
        const { data: holdingAccounts } = await supabase
          .from("holding_tank")
          .select("id, current_value")
          .eq("status", "holding");

        const holdingTankCount = holdingAccounts?.length ?? 0;
        const holdingTankTotal = (holdingAccounts || []).reduce(
          (sum, a) => sum + (Number(a.current_value) || 0),
          0
        );

        setStats({
          totalAssets,
          totalHouseholds: totalHouseholds ?? 0,
          sovereignCount,
          stabilizationCount,
          holdingTankTotal,
          holdingTankCount,
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Holding Tank */}
      {stats.holdingTankCount > 0 && (
        <Card
          className="border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition-colors"
          onClick={() => navigate("/holding-tank")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-600">
              <Anchor className="h-4 w-4" />
              Holding Tank
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(stats.holdingTankTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {stats.holdingTankCount} account{stats.holdingTankCount !== 1 ? "s" : ""} staged
            </p>
          </CardContent>
        </Card>
      )}

      {/* Household Total */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Home className="h-4 w-4" />
            Households
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-foreground">
            {stats.totalHouseholds}
          </p>
        </CardContent>
      </Card>

      {/* Governance Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Governance Status
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-sanctuary-green" />
            Sovereign
            <span className="font-semibold text-foreground ml-1">{stats.sovereignCount}</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-sanctuary-bronze" />
            Stabilization
            <span className="font-semibold text-foreground ml-1">{stats.stabilizationCount}</span>
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

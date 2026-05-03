import { useEffect, useState } from "react";
import { Loader2, TrendingUp, Anchor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Stats {
  totalAssets: number;
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
        const { data: vineyardAccounts } = await supabase
          .from("vineyard_accounts")
          .select("current_value");

        const { data: storehouseAccounts } = await supabase
          .from("storehouses")
          .select("current_value");

        const totalAssets =
          (vineyardAccounts || []).reduce((sum, a) => sum + (Number(a.current_value) || 0), 0) +
          (storehouseAccounts || []).reduce((sum, a) => sum + (Number(a.current_value) || 0), 0);

        const { data: holdingAccounts } = await supabase
          .from("holding_tank")
          .select("id, current_value")
          .eq("status", "holding");

        const holdingTankCount = holdingAccounts?.length ?? 0;
        const holdingTankTotal = (holdingAccounts || []).reduce(
          (sum, a) => sum + (Number(a.current_value) || 0),
          0
        );

        setStats({ totalAssets, holdingTankTotal, holdingTankCount });
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
      <div className="flex justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="flex items-center gap-6 border-y border-border/60 px-4 py-2 text-xs overflow-hidden whitespace-nowrap">
      <div className="flex items-center gap-2 text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>AUG</span>
        <span className="font-semibold text-foreground">{formatCurrency(stats.totalAssets)}</span>
      </div>

      {stats.holdingTankCount > 0 && (
        <button
          onClick={() => navigate("/holding-tank")}
          className="flex items-center gap-2 text-amber-600 hover:text-amber-500 transition-colors"
        >
          <Anchor className="h-3.5 w-3.5" />
          <span>Holding Tank</span>
          <span className="font-semibold">{formatCurrency(stats.holdingTankTotal)}</span>
          <span className="text-muted-foreground">
            ({stats.holdingTankCount} staged)
          </span>
        </button>
      )}
    </div>
  );
}

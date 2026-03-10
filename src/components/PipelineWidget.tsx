import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const CATEGORY_LABELS: Record<string, string> = {
  pws_consulting: "Consulting",
  new_aum: "AUM",
  insurance: "Insurance",
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

interface Summary {
  pending: number;
  inProcess: number;
  completed: number;
  byCategory: Record<string, number>;
}

export function PipelineWidget() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("business_pipeline" as any) as any).select("category, status, amount");
      const items = (data || []) as any[];
      const pending = items.filter((i) => i.status === "pending").reduce((s: number, i: any) => s + Number(i.amount), 0);
      const inProcess = items.filter((i) => i.status === "in_process").reduce((s: number, i: any) => s + Number(i.amount), 0);
      const completed = items.filter((i) => i.status === "completed").reduce((s: number, i: any) => s + Number(i.amount), 0);
      const byCategory: Record<string, number> = {};
      for (const i of items) {
        if (i.status !== "completed") {
          byCategory[i.category] = (byCategory[i.category] || 0) + Number(i.amount);
        }
      }
      setSummary({ pending, inProcess, completed, byCategory });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (!summary) return null;

  const totalActive = summary.pending + summary.inProcess;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Pipeline</span>
          <Link to="/pipeline" className="text-xs text-primary hover:underline">View All</Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold text-foreground">{formatCurrency(totalActive)}</p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>Pending: <strong className="text-foreground">{formatCurrency(summary.pending)}</strong></span>
          <span>In Process: <strong className="text-foreground">{formatCurrency(summary.inProcess)}</strong></span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {Object.entries(summary.byCategory).map(([cat, amt]) => (
            <Badge key={cat} variant="secondary" className="text-xs">
              {CATEGORY_LABELS[cat] || cat}: {formatCurrency(amt)}
            </Badge>
          ))}
        </div>
        {summary.completed > 0 && (
          <p className="text-xs text-muted-foreground pt-1">Completed: {formatCurrency(summary.completed)}</p>
        )}
      </CardContent>
    </Card>
  );
}

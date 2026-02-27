import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, Search, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Corporation {
  id: string;
  name: string;
  corporation_type: string;
  jurisdiction: string | null;
  fiscal_year_end: string | null;
  shareholder_count: number;
  total_assets: number;
}

const TYPE_LABELS: Record<string, string> = {
  opco: "Operating Co.",
  holdco: "Holding Co.",
  trust: "Trust",
  partnership: "Partnership",
  other: "Other",
};

const Corporations = () => {
  const { user } = useAuth();
  const [corps, setCorps] = useState<Corporation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("opco");
  const [newJurisdiction, setNewJurisdiction] = useState("");

  const fetchCorps = useCallback(async () => {
    const { data: corpData } = await (supabase.from("corporations" as any) as any)
      .select("*")
      .order("name");

    if (!corpData) { setLoading(false); return; }

    const corpIds = (corpData as any[]).map((c: any) => c.id);
    
    const [shareholdersRes, assetsRes] = await Promise.all([
      corpIds.length > 0
        ? (supabase.from("shareholders" as any) as any).select("corporation_id").in("corporation_id", corpIds)
        : Promise.resolve({ data: [] }),
      corpIds.length > 0
        ? (supabase.from("corporate_vineyard_accounts" as any) as any).select("corporation_id, current_value").in("corporation_id", corpIds)
        : Promise.resolve({ data: [] }),
    ]);

    const shareholderCounts: Record<string, number> = {};
    ((shareholdersRes.data || []) as any[]).forEach((s: any) => {
      shareholderCounts[s.corporation_id] = (shareholderCounts[s.corporation_id] || 0) + 1;
    });

    const assetTotals: Record<string, number> = {};
    ((assetsRes.data || []) as any[]).forEach((a: any) => {
      assetTotals[a.corporation_id] = (assetTotals[a.corporation_id] || 0) + Number(a.current_value || 0);
    });

    const mapped: Corporation[] = (corpData as any[]).map((c: any) => ({
      id: c.id,
      name: c.name,
      corporation_type: c.corporation_type,
      jurisdiction: c.jurisdiction,
      fiscal_year_end: c.fiscal_year_end,
      shareholder_count: shareholderCounts[c.id] || 0,
      total_assets: assetTotals[c.id] || 0,
    }));

    setCorps(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCorps(); }, [fetchCorps]);

  const createCorp = async () => {
    if (!newName.trim() || !user) return;
    const { error } = await (supabase.from("corporations" as any) as any)
      .insert({
        name: newName.trim(),
        corporation_type: newType,
        jurisdiction: newJurisdiction.trim() || null,
        created_by: user.id,
      });
    if (error) {
      toast.error("Failed to create corporation.");
    } else {
      toast.success("Corporation created.");
      setNewName("");
      setNewType("opco");
      setNewJurisdiction("");
      setShowNew(false);
      fetchCorps();
    }
  };

  const filtered = corps.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumbs items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Corporations" },
        ]} />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Corporations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {corps.length} corporate {corps.length === 1 ? "entity" : "entities"}
            </p>
          </div>
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Corporation
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search corporations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p>No corporations yet. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((corp) => (
              <Link key={corp.id} to={`/corporations/${corp.id}`}>
                <Card className="hover:border-accent/40 transition-colors cursor-pointer h-full">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-accent" />
                        <h3 className="font-semibold text-foreground">{corp.name}</h3>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABELS[corp.corporation_type] || corp.corporation_type}
                      </Badge>
                    </div>
                    {corp.jurisdiction && (
                      <p className="text-xs text-muted-foreground">{corp.jurisdiction}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {corp.shareholder_count} shareholder{corp.shareholder_count !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        ${corp.total_assets.toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* New Corporation Dialog */}
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Corporation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Smith Holdings Inc." />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Jurisdiction</label>
                <Input value={newJurisdiction} onChange={(e) => setNewJurisdiction(e.target.value)} placeholder="e.g. Ontario, Canada" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={createCorp} disabled={!newName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Corporations;

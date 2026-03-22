import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Anchor, ArrowRight, FileUp, Loader2 } from "lucide-react";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { toast } from "sonner";

interface HoldingTankAccount {
  id: string;
  contact_id: string;
  household_id: string | null;
  account_name: string;
  account_number: string | null;
  account_type: string;
  account_owner: string | null;
  custodian: string | null;
  book_value: number | null;
  current_value: number | null;
  notes: string | null;
  source_file: string | null;
  status: string;
  created_at: string;
}

interface GroupedContact {
  contact_id: string;
  contact_name: string;
  household_label: string | null;
  accounts: HoldingTankAccount[];
  total_value: number;
  total_book: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const HoldingTankPage = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupedContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: accounts } = await supabase
        .from("holding_tank")
        .select("*")
        .eq("status", "holding")
        .order("created_at", { ascending: false });

      if (!accounts?.length) { setGroups([]); setLoading(false); return; }

      const contactIds = [...new Set(accounts.map(a => a.contact_id))];
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, full_name, household_id")
        .in("id", contactIds);

      const householdIds = [...new Set((contacts || []).map(c => c.household_id).filter(Boolean))] as string[];
      let householdMap = new Map<string, string>();
      if (householdIds.length) {
        const { data: hh } = await supabase.from("households").select("id, label").in("id", householdIds);
        householdMap = new Map((hh || []).map(h => [h.id, h.label]));
      }

      const contactMap = new Map((contacts || []).map(c => [c.id, c]));

      const grouped = new Map<string, GroupedContact>();
      for (const acc of accounts) {
        const c = contactMap.get(acc.contact_id);
        if (!grouped.has(acc.contact_id)) {
          grouped.set(acc.contact_id, {
            contact_id: acc.contact_id,
            contact_name: c?.full_name || "Unknown",
            household_label: c?.household_id ? householdMap.get(c.household_id) || null : null,
            accounts: [],
            total_value: 0,
            total_book: 0,
          });
        }
        const g = grouped.get(acc.contact_id)!;
        g.accounts.push(acc);
        g.total_value += Number(acc.current_value) || 0;
        g.total_book += Number(acc.book_value) || 0;
      }

      setGroups(Array.from(grouped.values()));
      setLoading(false);
    })();
  }, []);

  const totalAccounts = groups.reduce((s, g) => s + g.accounts.length, 0);
  const totalValue = groups.reduce((s, g) => s + g.total_value, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Holding Tank" }]} />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Anchor className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold">The Holding Tank</h1>
              <p className="text-sm text-muted-foreground">
                Accounts awaiting Charter ratification
              </p>
            </div>
          </div>
          {totalAccounts > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-600">{fmt(totalValue)}</p>
              <Badge variant="secondary" className="text-xs">
                {totalAccounts} account{totalAccounts !== 1 ? "s" : ""} across {groups.length} contact{groups.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Anchor className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No accounts in the Holding Tank.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Upload statements on a contact's detail page to stage accounts here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <Card key={g.contact_id} className="border-amber-500/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        <button
                          className="hover:underline text-left"
                          onClick={() => navigate(`/contacts/${g.contact_id}`)}
                        >
                          {g.contact_name}
                        </button>
                      </CardTitle>
                      {g.household_label && (
                        <p className="text-xs text-muted-foreground">{g.household_label}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{fmt(g.total_value)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {g.accounts.length} account{g.accounts.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/contacts/${g.contact_id}`)}
                      >
                        Ratify
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-border">
                    {g.accounts.map((acc) => (
                      <div key={acc.id} className="flex items-center gap-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{acc.account_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{acc.account_type}</span>
                            {acc.custodian && <><span>·</span><span>{acc.custodian}</span></>}
                            {acc.account_number && <><span>·</span><span>#{acc.account_number}</span></>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold">{fmt(Number(acc.current_value) || 0)}</p>
                          {acc.book_value != null && (
                            <p className="text-[10px] text-muted-foreground">
                              BOY: {fmt(Number(acc.book_value))}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default HoldingTankPage;

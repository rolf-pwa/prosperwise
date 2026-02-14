import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, Users, CalendarCheck, ArrowRight } from "lucide-react";
import { differenceInDays, addDays, format } from "date-fns";

interface ContactSummary {
  id: string;
  full_name: string;
  governance_status: string;
  quiet_period_start_date: string | null;
  updated_at: string;
}

const Dashboard = () => {
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContacts() {
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name, governance_status, quiet_period_start_date, updated_at")
        .order("updated_at", { ascending: false });
      setContacts(data || []);
      setLoading(false);
    }
    fetchContacts();
  }, []);

  const activeQuietPeriods = contacts.filter(
    (c) => c.governance_status === "stabilization" && c.quiet_period_start_date
  );
  const ratifiedCharters = contacts.filter(
    (c) => c.governance_status === "sovereign"
  );

  const upcomingMilestones = activeQuietPeriods
    .map((c) => {
      const endDate = addDays(new Date(c.quiet_period_start_date!), 90);
      const daysLeft = differenceInDays(endDate, new Date());
      return { ...c, daysLeft, endDate };
    })
    .filter((c) => c.daysLeft > 0 && c.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const recentContacts = contacts.slice(0, 5);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sovereignty CRM Overview
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sanctuary-green/10">
                <Clock className="h-6 w-6 text-sanctuary-green" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Quiet Periods</p>
                <p className="text-2xl font-bold">{activeQuietPeriods.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sanctuary-bronze/10">
                <Shield className="h-6 w-6 text-sanctuary-bronze" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ratified Charters</p>
                <p className="text-2xl font-bold">{ratifiedCharters.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
                <p className="text-2xl font-bold">{contacts.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <CalendarCheck className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Command Center</p>
                <p className="text-xs text-sanctuary-green font-medium">Phase 2</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Contacts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Contacts</CardTitle>
              <Link
                to="/contacts"
                className="flex items-center gap-1 text-xs text-sanctuary-bronze hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : recentContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contacts yet.{" "}
                  <Link to="/contacts/new" className="text-sanctuary-bronze hover:underline">
                    Add your first contact
                  </Link>
                </p>
              ) : (
                <div className="space-y-3">
                  {recentContacts.map((c) => (
                    <Link
                      key={c.id}
                      to={`/contacts/${c.id}`}
                      className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="text-sm font-medium">{c.full_name}</span>
                      <Badge
                        variant={c.governance_status === "sovereign" ? "default" : "secondary"}
                        className={
                          c.governance_status === "sovereign"
                            ? "bg-sanctuary-bronze/20 text-sanctuary-bronze border-sanctuary-bronze/30"
                            : ""
                        }
                      >
                        {c.governance_status === "sovereign" ? "Sovereign" : "Stabilization"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Milestones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingMilestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contacts approaching Quiet Period completion.
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingMilestones.map((c) => (
                    <Link
                      key={c.id}
                      to={`/contacts/${c.id}`}
                      className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <span className="text-sm font-medium">{c.full_name}</span>
                        <p className="text-xs text-muted-foreground">
                          Completes {format(c.endDate, "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge className="bg-sanctuary-green/20 text-sanctuary-green border-sanctuary-green/30">
                        {c.daysLeft}d left
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Command Center Placeholder */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CalendarCheck className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <h3 className="font-semibold text-foreground">Command Center</h3>
              <p className="text-sm text-muted-foreground">
                Google Calendar & Gmail integration coming in Phase 2.
              </p>
            </div>
            <Badge variant="outline" className="text-sanctuary-green border-sanctuary-green/30">
              Coming Soon
            </Badge>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;

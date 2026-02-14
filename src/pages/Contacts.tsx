import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  governance_status: string;
  fiduciary_entity: string;
  updated_at: string;
}

const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContacts() {
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name, email, phone, governance_status, fiduciary_entity, updated_at")
        .order("full_name");
      setContacts(data || []);
      setLoading(false);
    }
    fetchContacts();
  }, []);

  const filtered = contacts.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contacts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The Sovereignty Engine — {contacts.length} contacts
            </p>
          </div>
          <Button asChild className="bg-sanctuary-bronze text-sanctuary-charcoal hover:bg-sanctuary-bronze/90">
            <Link to="/contacts/new">
              <Plus className="mr-2 h-4 w-4" />
              New Contact
            </Link>
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading contacts...</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-muted-foreground">
                {search ? "No contacts match your search." : "No contacts yet."}
              </p>
              {!search && (
                <Button asChild variant="outline">
                  <Link to="/contacts/new">Add your first contact</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <Link key={c.id} to={`/contacts/${c.id}`}>
                <Card className="transition-colors hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-0.5">
                      <p className="font-medium">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact info"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs uppercase"
                      >
                        {c.fiduciary_entity}
                      </Badge>
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
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Contacts;

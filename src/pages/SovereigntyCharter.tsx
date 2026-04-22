import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2, Printer } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import pwLogoWhite from "@/assets/prosperwise-logo-white.png";

type ContactRecord = {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  family_id: string | null;
  household_id: string | null;
  charter_url: string | null;
  quiet_period_start_date: string | null;
  governance_status: string;
  lawyer_name: string | null;
  accountant_name: string | null;
  executor_name: string | null;
  poa_name: string | null;
  email: string | null;
  phone: string | null;
};

type FamilyRecord = {
  id: string;
  name: string;
  charter_document_url: string | null;
  total_family_assets: number;
  annual_savings: number;
  fee_tier: string;
};

type VineyardAccount = {
  id: string;
  account_name: string;
  account_number: string | null;
  account_type: string;
  current_value: number | null;
  book_value: number | null;
  notes: string | null;
};

type Storehouse = {
  id: string;
  label: string;
  storehouse_number: number;
  current_value: number | null;
  target_value: number | null;
  asset_type: string | null;
  notes: string | null;
  risk_cap: string | null;
};

type StorehouseRule = {
  id: string;
  storehouse_label: string;
  storehouse_number: number;
  rule_type: string;
  rule_description: string;
  rule_value: number | null;
};

type WaterfallPriority = {
  id: string;
  priority_order: number;
  priority_label: string;
  priority_description: string | null;
  target_amount: number | null;
  is_active: boolean;
};

const formatCurrency = (value: number | null | undefined) =>
  value == null || Number.isNaN(value)
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

const formatDate = (value: string | null | undefined, fallback = "To be ratified") => {
  if (!value) return fallback;
  try {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))), "MMMM d, yyyy");
    }
    return format(new Date(value), "MMMM d, yyyy");
  } catch {
    return value;
  }
};

const isProtectedAccount = (account: VineyardAccount) =>
  /(rrsp|tfsa|lira|rrif|pension|locked)/i.test(account.account_type) ||
  /(protected|legacy|locked)/i.test(account.notes || "");

const pageWrap = "stab-doc bg-white shadow-lg print:shadow-none";

export default function SovereigntyCharter() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<ContactRecord | null>(null);
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [vineyardAccounts, setVineyardAccounts] = useState<VineyardAccount[]>([]);
  const [storehouses, setStorehouses] = useState<Storehouse[]>([]);
  const [storehouseRules, setStorehouseRules] = useState<StorehouseRule[]>([]);
  const [waterfallPriorities, setWaterfallPriorities] = useState<WaterfallPriority[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!contactId) return;

      setLoading(true);
      const { data: contactData, error: contactError } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, full_name, family_id, household_id, charter_url, quiet_period_start_date, governance_status, lawyer_name, accountant_name, executor_name, poa_name, email, phone")
        .eq("id", contactId)
        .maybeSingle();

      if (contactError || !contactData) {
        toast.error(contactError?.message || "Charter contact not found");
        setLoading(false);
        return;
      }

      setContact(contactData as ContactRecord);

      const familyId = contactData.family_id;
      const [familyRes, vineyardRes, storehousesRes, rulesRes, waterfallRes] = await Promise.all([
        familyId
          ? supabase.from("families").select("id, name, charter_document_url, total_family_assets, annual_savings, fee_tier").eq("id", familyId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from("vineyard_accounts").select("id, account_name, account_number, account_type, current_value, book_value, notes").eq("contact_id", contactId).order("created_at"),
        supabase.from("storehouses").select("id, label, storehouse_number, current_value, target_value, asset_type, notes, risk_cap").eq("contact_id", contactId).order("storehouse_number"),
        familyId
          ? supabase.from("storehouse_rules").select("id, storehouse_label, storehouse_number, rule_type, rule_description, rule_value").eq("family_id", familyId).order("storehouse_number")
          : Promise.resolve({ data: [], error: null }),
        familyId
          ? supabase.from("waterfall_priorities").select("id, priority_order, priority_label, priority_description, target_amount, is_active").eq("family_id", familyId).order("priority_order")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (familyRes.error) toast.error(familyRes.error.message);
      if (vineyardRes.error) toast.error(vineyardRes.error.message);
      if (storehousesRes.error) toast.error(storehousesRes.error.message);
      if (rulesRes.error) toast.error(rulesRes.error.message);
      if (waterfallRes.error) toast.error(waterfallRes.error.message);

      setFamily((familyRes.data as FamilyRecord | null) || null);
      setVineyardAccounts((vineyardRes.data as VineyardAccount[] | null) || []);
      setStorehouses((storehousesRes.data as Storehouse[] | null) || []);
      setStorehouseRules((rulesRes.data as StorehouseRule[] | null) || []);
      setWaterfallPriorities(((waterfallRes.data as WaterfallPriority[] | null) || []).filter((item) => item.is_active));
      setLoading(false);
    };

    load();
  }, [contactId]);

  const fullName = useMemo(() => {
    if (!contact) return "";
    return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  }, [contact]);

  const sourceCharterUrl = contact?.charter_url || family?.charter_document_url || null;

  const protectedAccounts = useMemo(
    () => vineyardAccounts.filter(isProtectedAccount),
    [vineyardAccounts]
  );

  const harvestAccounts = useMemo(
    () => vineyardAccounts.filter((account) => !isProtectedAccount(account)),
    [vineyardAccounts]
  );

  const groupedRules = useMemo(() => {
    return storehouseRules.reduce<Record<string, StorehouseRule[]>>((acc, rule) => {
      const key = rule.storehouse_label || `Storehouse ${rule.storehouse_number}`;
      acc[key] = [...(acc[key] || []), rule];
      return acc;
    }, {});
  }, [storehouseRules]);

  const stewardshipValue = useMemo(() => {
    const vineyard = vineyardAccounts.reduce((sum, account) => sum + (account.current_value || 0), 0);
    const storehouseTotal = storehouses.reduce((sum, storehouse) => sum + (storehouse.current_value || 0), 0);
    return vineyard + storehouseTotal;
  }, [storehouses, vineyardAccounts]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Charter contact not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/contacts")}> 
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6F2]">
      <div className="print:hidden sticky top-0 z-20 border-b border-[#D3C5B7] bg-[#F8F6F2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <div className="text-sm text-[#3B3F3F]">
              <span className="font-semibold">Sovereignty Charter</span>
              <span className="ml-2 text-xs uppercase tracking-wider text-[#A98C5A]">Portrait template</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sourceCharterUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={sourceCharterUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open source
                </a>
              </Button>
            )}
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print / PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] px-6 py-6 print:p-0 print:max-w-none">
        <div className={`${pageWrap}`} style={{ width: "210mm", minHeight: "297mm", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif", color: "#3B3F3F" }}>
          <div style={{ backgroundColor: "#2A4034", color: "#fff", padding: "10mm 12mm 9mm" }}>
            <img src={pwLogoWhite} alt="ProsperWise" style={{ width: "54mm", height: "auto", display: "block", marginBottom: "4mm" }} />
            <div style={{ fontSize: "8pt", fontWeight: 300, color: "rgba(255,255,255,.55)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "4mm" }}>
              Sovereignty Operating System
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24pt", fontWeight: 300, lineHeight: 1.08 }}>
              {family?.name || fullName} Sovereignty Charter
            </div>
            <div style={{ fontSize: "8pt", color: "rgba(255,255,255,.7)", marginTop: "2.5mm" }}>
              A constitutional framework for financial governance
            </div>
          </div>

          <div style={{ padding: "12mm", display: "flex", flexDirection: "column", gap: "6mm" }}>
            <div>
              <div style={{ fontSize: "7.5pt", letterSpacing: ".1em", textTransform: "uppercase", color: "#7a8a8a", marginBottom: "1.5mm" }}>
                Sovereignty Charter &nbsp;·&nbsp; Prepared for <strong>{fullName}</strong>
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "25pt", fontWeight: 300, color: "#3B3F3F", lineHeight: 1.1 }}>
                Constitutional Framework<br />for Financial Governance
              </div>
              <hr style={{ width: "18mm", height: "3px", background: "#A98C5A", border: "none", marginTop: "2.5mm" }} />
            </div>

            <div style={{ background: "#F8F6F2", borderLeft: "3px solid #A98C5A", padding: "3mm 5mm", display: "flex", flexDirection: "column", gap: "1.5mm" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "7.5pt", fontWeight: 400, fontStyle: "italic", color: "#3B3F3F", lineHeight: 1.55 }}>
                The assets of {fullName} are to be governed as a Vineyard designed to serve stability, legacy, and disciplined decision-making rather than short-term reaction.
              </div>
              <div style={{ fontSize: "7.5pt", color: "#3B3F3F" }}>
                This portrait format mirrors the Stabilization Map and Quarterly Review so the Charter reads like one unified governance system.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm" }}>
              <SectionCard
                title="Mission of Capital"
                body={`The current territory is stewarded toward durable household stability, tax-aware growth, and long-horizon legacy transfer. ${family?.annual_savings ? `The family is currently tracking approximately ${formatCurrency(family.annual_savings)} in annual savings capacity.` : "The strategy should define a target after-tax cash flow threshold and a reinvestment discipline."}`}
              />
              <SectionCard
                title="20-Year Vision"
                body={`${family?.total_family_assets ? `Current tracked family assets are ${formatCurrency(family.total_family_assets)}.` : `Current tracked stewardship value is ${formatCurrency(stewardshipValue)}.`} The long-range objective is to compound core Vineyard assets, protect key reserves, and preserve intergenerational optionality through a deliberate governance structure.`}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm" }}>
              <ArticleCard title="Governance & Authority" body={`${fullName} remains the sovereign decision-maker. ProsperWise serves as Personal CFO, coordinating structure, sequencing, and the architectural integrity of the Charter.`} />
              <ArticleCard title="Conflict Resolution & Representation" body={`${contact.poa_name ? `Powers of Attorney currently noted: ${contact.poa_name}.` : "Powers of Attorney should be named explicitly."} In incapacity events, this Charter operates as an interpretive guide for aligned decision-making.`} />
              <ArticleCard title="Fiduciary Alliance" body={`${contact.lawyer_name || contact.accountant_name ? `Current professionals include ${[contact.lawyer_name, contact.accountant_name].filter(Boolean).join(" and ")}.` : "Legal and tax professionals should be linked to this Charter."} All structural and tax actions remain subject to professional review.`} />
              <ArticleCard title="Secondary Quiet Period" body={contact.quiet_period_start_date ? `A quiet period anchor exists from ${formatDate(contact.quiet_period_start_date)}. New capital events should pause for structured integration before deployment.` : "Capital inflows above the family threshold should trigger a quiet period before new deployment decisions are finalized."} />
            </div>
          </div>

          <div style={{ background: "#A98C5A", color: "#fff", marginTop: "auto", padding: "3mm 12mm", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "8.5pt", fontWeight: 500, maxWidth: "75%" }}>
              Ratification status: {contact.governance_status === "sovereign" ? "Ratified / Sovereign phase" : "Draft / review in progress"}
            </div>
            <div style={{ fontSize: "7.5pt", opacity: 0.9 }}>{formatDate(contact.quiet_period_start_date, "Ratification date to be confirmed")}</div>
          </div>
        </div>

        <div className={`${pageWrap} print-page-break`} style={{ width: "210mm", minHeight: "297mm", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif", color: "#3B3F3F", marginTop: "6mm" }}>
          <div style={{ backgroundColor: "#2A4034", color: "#fff", padding: "9mm 12mm 8mm" }}>
            <div style={{ fontSize: "8pt", fontWeight: 300, color: "rgba(255,255,255,.55)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "3mm" }}>
              Charter Architecture
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "23pt", fontWeight: 300, lineHeight: 1.08 }}>
              Vineyard Protocol & Storehouses
            </div>
          </div>

          <div style={{ padding: "12mm", display: "flex", flexDirection: "column", gap: "6mm" }}>
            <div style={{ background: "#F8F6F2", borderLeft: "3px solid #A98C5A", padding: "3mm 5mm", display: "flex", flexDirection: "column", gap: "1.5mm" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "7.5pt", fontWeight: 400, fontStyle: "italic", color: "#3B3F3F", lineHeight: 1.55 }}>
                The Vineyard serves as the master container for income-generating assets. Principal is protected by design; only designated harvest should move into storehouse allocation.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm" }}>
              <SectionCard
                title="Protected Assets"
                body={protectedAccounts.length ? undefined : "No protected accounts have been explicitly classified yet."}
                items={protectedAccounts.map((account) => `${account.account_name}${account.account_number ? ` (${account.account_number})` : ""} · ${formatCurrency(account.current_value)}`)}
              />
              <SectionCard
                title="Eligible Harvest Accounts"
                body={harvestAccounts.length ? undefined : "No eligible harvest accounts are currently defined."}
                items={harvestAccounts.map((account) => `${account.account_name}${account.account_number ? ` (${account.account_number})` : ""} · ${formatCurrency(account.current_value)}`)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4mm" }}>
              {storehouses.length > 0 ? storehouses.map((storehouse) => {
                const rules = groupedRules[storehouse.label] || groupedRules[`Storehouse ${storehouse.storehouse_number}`] || [];
                return (
                  <div key={storehouse.id} style={{ background: "#F8F6F2", borderLeft: "3px solid #A98C5A", padding: "3mm 4mm" }}>
                    <strong style={{ display: "block", fontSize: "8.5pt", fontWeight: 600, color: "#3B3F3F", marginBottom: "1mm" }}>
                      {storehouse.label}
                    </strong>
                    <div style={{ fontSize: "7.5pt", color: "#6B7070", marginBottom: "2mm" }}>
                      Current {formatCurrency(storehouse.current_value)} · Target {formatCurrency(storehouse.target_value)}
                    </div>
                    {storehouse.asset_type && <div style={{ fontSize: "7.5pt", color: "#3B3F3F", marginBottom: "1.5mm" }}>{storehouse.asset_type}</div>}
                    {storehouse.risk_cap && <div style={{ fontSize: "7.5pt", color: "#3B3F3F", marginBottom: "1.5mm" }}>Risk cap: {storehouse.risk_cap}</div>}
                    {(rules.length ? rules.map((rule) => rule.rule_description) : storehouse.notes ? [storehouse.notes] : ["Rules and operating guidance to be defined."]).map((item, index) => (
                      <div key={index} style={{ display: "flex", gap: "2mm", marginTop: "1.2mm" }}>
                        <div style={{ width: "4px", height: "4px", borderRadius: "999px", background: "#A98C5A", marginTop: "5px", flexShrink: 0 }} />
                        <p style={{ fontSize: "7.5pt", lineHeight: 1.5 }}>{item}</p>
                      </div>
                    ))}
                  </div>
                );
              }) : (
                <div style={{ gridColumn: "1 / -1", background: "#F8F6F2", padding: "4mm", fontSize: "8pt", color: "#6B7070" }}>
                  No storehouses are currently configured for this contact.
                </div>
              )}
            </div>

            <SectionCard
              title="Sovereign Waterfall"
              body={waterfallPriorities.length ? undefined : "Waterfall priorities have not yet been defined for this family."}
              items={waterfallPriorities.map((priority) => `${priority.priority_order}. ${priority.priority_label}${priority.target_amount ? ` · ${formatCurrency(priority.target_amount)}` : ""}${priority.priority_description ? ` — ${priority.priority_description}` : ""}`)}
            />
          </div>
        </div>

        <div className={`${pageWrap} print-page-break`} style={{ width: "210mm", minHeight: "297mm", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif", color: "#3B3F3F", marginTop: "6mm" }}>
          <div style={{ backgroundColor: "#2A4034", color: "#fff", padding: "9mm 12mm 8mm" }}>
            <div style={{ fontSize: "8pt", fontWeight: 300, color: "rgba(255,255,255,.55)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "3mm" }}>
              Appendix A
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "23pt", fontWeight: 300, lineHeight: 1.08 }}>
              Structural Architecture & Territory Schedule
            </div>
          </div>

          <div style={{ padding: "12mm", display: "flex", flexDirection: "column", gap: "5mm" }}>
            <div style={{ background: "#F8F6F2", borderLeft: "3px solid #A98C5A", padding: "3mm 5mm", fontFamily: "'DM Sans', sans-serif", fontSize: "7.5pt", fontWeight: 400, fontStyle: "italic", color: "#3B3F3F", lineHeight: 1.65 }}>
              This appendix condenses the current territory into a printable schedule so the Charter, Stabilization Map, and Quarterly Review all reference the same canonical structure.
            </div>

            <ScheduleTable
              title="Vineyard Accounts"
              rows={vineyardAccounts.map((account) => ({
                label: account.account_name,
                type: account.account_type,
                value: formatCurrency(account.current_value),
                note: isProtectedAccount(account) ? "Protected" : "Eligible Harvest",
              }))}
              emptyLabel="No Vineyard accounts are currently linked."
            />

            <ScheduleTable
              title="Storehouses"
              rows={storehouses.map((storehouse) => ({
                label: storehouse.label,
                type: storehouse.asset_type || `Storehouse #${storehouse.storehouse_number}`,
                value: formatCurrency(storehouse.current_value),
                note: storehouse.risk_cap || storehouse.notes || "Governed reserve",
              }))}
              emptyLabel="No Storehouses are currently linked."
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm" }}>
              <MetricCard label="Tracked Stewardship Value" value={formatCurrency(stewardshipValue || family?.total_family_assets)} />
              <MetricCard label="Source Charter Link" value={sourceCharterUrl ? "Linked" : "Not linked"} />
            </div>
          </div>
        </div>

        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { background: white !important; }
            .stab-doc { margin: 0 !important; }
            .print-page-break { break-before: page; page-break-before: always; }
          }
        `}</style>
      </div>
    </div>
  );
}

function SectionCard({ title, body, items }: { title: string; body?: string; items?: string[] }) {
  return (
    <div style={{ background: "#F8F6F2", borderLeft: "3px solid #A98C5A", padding: "3mm 4mm" }}>
      <div style={{ fontSize: "6.5pt", letterSpacing: ".12em", textTransform: "uppercase", color: "#7a8a8a", marginBottom: "1.5mm" }}>{title}</div>
      {body && <p style={{ fontSize: "7.5pt", lineHeight: 1.55 }}>{body}</p>}
      {items?.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.4mm" }}>
          {items.map((item, index) => (
            <div key={index} style={{ display: "flex", gap: "2mm" }}>
              <div style={{ width: "4px", height: "4px", borderRadius: "999px", background: "#A98C5A", marginTop: "5px", flexShrink: 0 }} />
              <p style={{ fontSize: "7.5pt", lineHeight: 1.5 }}>{item}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ArticleCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ border: "1px solid #D3C5B7", padding: "4mm", background: "#fff" }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "13pt", fontWeight: 500, color: "#3B3F3F", marginBottom: "1.5mm" }}>{title}</div>
      <p style={{ fontSize: "7.5pt", lineHeight: 1.6, color: "#3B3F3F" }}>{body}</p>
    </div>
  );
}

function ScheduleTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: Array<{ label: string; type: string; value: string; note: string }>;
  emptyLabel: string;
}) {
  const headCell: React.CSSProperties = {
    fontSize: "7pt",
    fontWeight: 600,
    color: "#6B7070",
    textTransform: "uppercase",
    letterSpacing: ".08em",
    padding: "2.4mm 2mm",
    borderBottom: "1px solid #D9CDBF",
    textAlign: "left",
  };

  const bodyCell: React.CSSProperties = {
    fontSize: "7.5pt",
    padding: "2.4mm 2mm",
    borderBottom: "1px solid #ECE5DB",
    verticalAlign: "top",
  };

  return (
    <div>
      <div style={{ fontSize: "6.5pt", letterSpacing: ".12em", textTransform: "uppercase", color: "#7a8a8a", marginBottom: "2mm" }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ background: "#F8F6F2", padding: "4mm", fontSize: "8pt", color: "#6B7070" }}>{emptyLabel}</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#F8F6F2" }}>
              <th style={{ ...headCell, width: "32%" }}>Account</th>
              <th style={{ ...headCell, width: "22%" }}>Type</th>
              <th style={{ ...headCell, width: "18%" }}>Value</th>
              <th style={{ ...headCell, width: "28%" }}>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <td style={bodyCell}>{row.label}</td>
                <td style={bodyCell}>{row.type}</td>
                <td style={bodyCell}>{row.value}</td>
                <td style={bodyCell}>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#F8F6F2", borderLeft: "3px solid #A98C5A", padding: "3mm 4mm" }}>
      <div style={{ fontSize: "6.5pt", letterSpacing: ".12em", textTransform: "uppercase", color: "#7a8a8a", marginBottom: "1.2mm" }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "16pt", fontWeight: 500, color: "#3B3F3F" }}>{value}</div>
    </div>
  );
}
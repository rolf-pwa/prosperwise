import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bot, CheckCircle2, ExternalLink, FileText, Loader2, Pencil, Plus, Printer, Save, ScrollText, Sparkles, Trash2, Upload, WandSparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { draftSovereigntyCharter, isValidSourceUrl, sanitizeSourceText, sanitizeSourceTitle, sanitizeSourceUrl, uploadCharterSourceFile, type CharterDraftStatus, type CharterSourceInputMode, type CharterSourceKind, type CharterSourceRecord } from "@/lib/charter";
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

type CustomContainer = {
  id: string;
  title: string;
  meta: string;
  body: string;
};

type CustomSectionGroups = {
  pageOne: CustomContainer[];
  pageTwo: CustomContainer[];
};

type CharterRecord = {
  id?: string;
  contact_id: string;
  title: string;
  subtitle: string;
  intro_heading: string;
  intro_callout: string;
  intro_note: string;
  mission_of_capital: string;
  vision_20_year: string;
  governance_authority: string;
  conflict_resolution: string;
  fiduciary_alliance: string;
  quiet_period: string;
  architecture_intro: string;
  protected_assets_note: string;
  harvest_accounts_note: string;
  appendix_note: string;
  footer_status: string;
  footer_date_label: string;
  custom_sections: CustomSectionGroups;
  draft_status?: CharterDraftStatus;
  ratified_at?: string | null;
  ratified_by?: string | null;
  generation_summary?: string | null;
  last_generated_at?: string | null;
};

type CharterSourceDraft = {
  id: string;
  sourceKind: CharterSourceKind;
  title: string;
  inputMode: CharterSourceInputMode;
  contentText: string;
  sourceUrl: string;
  file: File | null;
  storedPath: string | null;
  fileName: string | null;
  mimeType: string | null;
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

const STOREHOUSE_CONFIG = [
  { num: 1, name: "The Keep", subtitle: "Liquidity Reserve" },
  { num: 2, name: "The Armoury", subtitle: "Strategic Reserve" },
  { num: 3, name: "The Granary", subtitle: "Philanthropic Trust" },
  { num: 4, name: "The Vault", subtitle: "Legacy Trust" },
];

const newCustomContainer = (): CustomContainer => ({
  id: crypto.randomUUID(),
  title: "Additional Container",
  meta: "Current — · Target —",
  body: "Describe the purpose, constraints, and operating rules for this container.",
});

const newSourceDraft = (kind: CharterSourceKind = "note", mode: CharterSourceInputMode = "text"): CharterSourceDraft => ({
  id: crypto.randomUUID(),
  sourceKind: kind,
  title:
    kind === "statement"
      ? "Account statement"
      : kind === "stabilization_session"
        ? "Stabilization Session"
        : kind === "meeting_transcript"
          ? "Gemini meeting transcript"
          : kind === "link"
            ? "Reference link"
            : "Advisor note",
  inputMode: mode,
  contentText: "",
  sourceUrl: "",
  file: null,
  storedPath: null,
  fileName: null,
  mimeType: null,
});

export default function SovereigntyCharter() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [ratifying, setRatifying] = useState(false);
  const [contact, setContact] = useState<ContactRecord | null>(null);
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [vineyardAccounts, setVineyardAccounts] = useState<VineyardAccount[]>([]);
  const [storehouses, setStorehouses] = useState<Storehouse[]>([]);
  const [storehouseRules, setStorehouseRules] = useState<StorehouseRule[]>([]);
  const [waterfallPriorities, setWaterfallPriorities] = useState<WaterfallPriority[]>([]);
  const [charter, setCharter] = useState<CharterRecord | null>(null);
  const [charterSources, setCharterSources] = useState<CharterSourceDraft[]>([newSourceDraft("statement", "upload"), newSourceDraft("meeting_transcript", "text")]);

  const fullName = useMemo(() => {
    if (!contact) return "";
    return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  }, [contact]);

  const sourceCharterUrl = contact?.charter_url || family?.charter_document_url || null;

  const protectedAccounts = useMemo(() => vineyardAccounts.filter(isProtectedAccount), [vineyardAccounts]);
  const harvestAccounts = useMemo(() => vineyardAccounts.filter((account) => !isProtectedAccount(account)), [vineyardAccounts]);

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

  const buildDefaultCharter = (
    contactRecord: ContactRecord,
    familyRecord: FamilyRecord | null,
    totalStewardship: number
  ): CharterRecord => {
    const resolvedFullName = [contactRecord.first_name, contactRecord.last_name].filter(Boolean).join(" ");

    return {
      contact_id: contactRecord.id,
      title: `${familyRecord?.name || resolvedFullName} Sovereignty Charter`,
      subtitle: "A constitutional framework for financial governance",
      intro_heading: "Constitutional Framework\nfor Financial Governance",
      intro_callout: `The assets of ${resolvedFullName} are to be governed as a Vineyard designed to serve stability, legacy, and disciplined decision-making rather than short-term reaction.`,
      intro_note: "This portrait format mirrors the Stabilization Map and Quarterly Review so the Charter reads like one unified governance system.",
      mission_of_capital: `The current territory is stewarded toward durable household stability, tax-aware growth, and long-horizon legacy transfer. ${familyRecord?.annual_savings ? `The family is currently tracking approximately ${formatCurrency(familyRecord.annual_savings)} in annual savings capacity.` : "The strategy should define a target after-tax cash flow threshold and a reinvestment discipline."}`,
      vision_20_year: `${familyRecord?.total_family_assets ? `Current tracked family assets are ${formatCurrency(familyRecord.total_family_assets)}.` : `Current tracked stewardship value is ${formatCurrency(totalStewardship)}.`} The long-range objective is to compound core Vineyard assets, protect key reserves, and preserve intergenerational optionality through a deliberate governance structure.`,
      governance_authority: `${resolvedFullName} remains the sovereign decision-maker. ProsperWise serves as Personal CFO, coordinating structure, sequencing, and the architectural integrity of the Charter.`,
      conflict_resolution: `${contactRecord.poa_name ? `Powers of Attorney currently noted: ${contactRecord.poa_name}.` : "Powers of Attorney should be named explicitly."} In incapacity events, this Charter operates as an interpretive guide for aligned decision-making.`,
      fiduciary_alliance: `${contactRecord.lawyer_name || contactRecord.accountant_name ? `Current professionals include ${[contactRecord.lawyer_name, contactRecord.accountant_name].filter(Boolean).join(" and ")}.` : "Legal and tax professionals should be linked to this Charter."} All structural and tax actions remain subject to professional review.`,
      quiet_period: contactRecord.quiet_period_start_date
        ? `A quiet period anchor exists from ${formatDate(contactRecord.quiet_period_start_date)}. New capital events should pause for structured integration before deployment.`
        : "Capital inflows above the family threshold should trigger a quiet period before new deployment decisions are finalized.",
      architecture_intro: "The Vineyard serves as the master container for income-generating assets. Principal is protected by design; only designated harvest should move into storehouse allocation.",
      protected_assets_note: "No protected accounts have been explicitly classified yet.",
      harvest_accounts_note: "No eligible harvest accounts are currently defined.",
      appendix_note: "This appendix condenses the current territory into a printable schedule so the Charter, Stabilization Map, and Quarterly Review all reference the same canonical structure.",
      footer_status: contactRecord.governance_status === "sovereign" ? "Ratified / Sovereign phase" : "Draft / review in progress",
      footer_date_label: formatDate(contactRecord.quiet_period_start_date, "Ratification date to be confirmed"),
      custom_sections: { pageOne: [], pageTwo: [] },
    };
  };

  const normalizeContainerList = (value: unknown): CustomContainer[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        return {
          id: typeof record.id === "string" && record.id ? record.id : crypto.randomUUID(),
          title: typeof record.title === "string" ? record.title : "Additional Container",
          meta: typeof record.meta === "string" ? record.meta : "",
          body: typeof record.body === "string" ? record.body : "",
        };
      })
      .filter(Boolean) as CustomContainer[];
  };

  const normalizeCustomSections = (value: unknown): CustomSectionGroups => {
    if (Array.isArray(value)) {
      return {
        pageOne: normalizeContainerList(value),
        pageTwo: [],
      };
    }

    if (!value || typeof value !== "object") {
      return { pageOne: [], pageTwo: [] };
    }

    const record = value as Record<string, unknown>;
    return {
      pageOne: normalizeContainerList(record.pageOne),
      pageTwo: normalizeContainerList(record.pageTwo),
    };
  };

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

    const resolvedContact = contactData as ContactRecord;
    setContact(resolvedContact);

    const familyId = resolvedContact.family_id;
    const [familyRes, vineyardRes, storehousesRes, rulesRes, waterfallRes, charterRes, sourceRes] = await Promise.all([
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
      supabase.from("sovereignty_charters" as any).select("*").eq("contact_id", contactId).maybeSingle(),
      supabase.from("sovereignty_charter_sources" as any).select("*").eq("contact_id", contactId).order("sort_order"),
    ]);

    if (familyRes.error) toast.error(familyRes.error.message);
    if (vineyardRes.error) toast.error(vineyardRes.error.message);
    if (storehousesRes.error) toast.error(storehousesRes.error.message);
    if (rulesRes.error) toast.error(rulesRes.error.message);
    if (waterfallRes.error) toast.error(waterfallRes.error.message);
    if (charterRes.error) toast.error(charterRes.error.message);
    if (sourceRes.error) toast.error(sourceRes.error.message);

    const resolvedFamily = (familyRes.data as FamilyRecord | null) || null;
    const resolvedVineyard = (vineyardRes.data as VineyardAccount[] | null) || [];
    const resolvedStorehouses = (storehousesRes.data as Storehouse[] | null) || [];
    const resolvedRules = (rulesRes.data as StorehouseRule[] | null) || [];
    const resolvedWaterfalls = ((waterfallRes.data as WaterfallPriority[] | null) || []).filter((item) => item.is_active);

    setFamily(resolvedFamily);
    setVineyardAccounts(resolvedVineyard);
    setStorehouses(resolvedStorehouses);
    setStorehouseRules(resolvedRules);
    setWaterfallPriorities(resolvedWaterfalls);

    const resolvedSources = (((sourceRes.data as unknown) as CharterSourceRecord[] | null) || []).map((source) => ({
      id: source.id,
      sourceKind: source.source_kind,
      title: source.title,
      inputMode: source.input_mode,
      contentText: source.content_text || source.extracted_text || "",
      sourceUrl: source.source_url || "",
      file: null,
      storedPath: source.storage_path,
      fileName: source.file_name,
      mimeType: source.mime_type,
    }));
    setCharterSources(resolvedSources.length ? resolvedSources : [newSourceDraft("statement", "upload"), newSourceDraft("meeting_transcript", "text")]);

    const totalStewardship =
      resolvedVineyard.reduce((sum, account) => sum + (account.current_value || 0), 0) +
      resolvedStorehouses.reduce((sum, storehouse) => sum + (storehouse.current_value || 0), 0);

    const baseCharter = buildDefaultCharter(resolvedContact, resolvedFamily, totalStewardship);
    const savedCharter = charterRes.data as unknown as Record<string, unknown> | null;

    if (savedCharter) {
      setCharter({
        ...baseCharter,
        ...savedCharter,
        id: typeof savedCharter.id === "string" ? savedCharter.id : undefined,
        contact_id: resolvedContact.id,
        custom_sections: normalizeCustomSections(savedCharter.custom_sections),
      });
    } else {
      setCharter(baseCharter);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [contactId]);

  const updateField = (key: keyof CharterRecord, value: string) => {
    setCharter((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateCustomContainer = (page: keyof CustomSectionGroups, id: string, key: keyof CustomContainer, value: string) => {
    setCharter((current) => {
      if (!current) return current;
      return {
        ...current,
        custom_sections: {
          ...current.custom_sections,
          [page]: current.custom_sections[page].map((section) =>
            section.id === id ? { ...section, [key]: value } : section
          ),
        },
      };
    });
  };

  const addCustomContainer = (page: keyof CustomSectionGroups) => {
    setCharter((current) => {
      if (!current) return current;
      return {
        ...current,
        custom_sections: {
          ...current.custom_sections,
          [page]: [...current.custom_sections[page], newCustomContainer()],
        },
      };
    });
  };

  const removeCustomContainer = (page: keyof CustomSectionGroups, id: string) => {
    setCharter((current) => {
      if (!current) return current;
      return {
        ...current,
        custom_sections: {
          ...current.custom_sections,
          [page]: current.custom_sections[page].filter((section) => section.id !== id),
        },
      };
    });
  };

  const updateSource = (id: string, patch: Partial<CharterSourceDraft>) => {
    setCharterSources((current) => current.map((source) => (source.id === id ? { ...source, ...patch } : source)));
  };

  const addSource = (kind: CharterSourceKind = "note", mode: CharterSourceInputMode = kind === "link" ? "url" : "text") => {
    setCharterSources((current) => [...current, newSourceDraft(kind, mode)]);
  };

  const removeSource = (id: string) => {
    setCharterSources((current) => (current.length > 1 ? current.filter((source) => source.id !== id) : current));
  };

  const handleSourceFileChange = (id: string) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    updateSource(id, {
      file,
      storedPath: null,
      fileName: file?.name || null,
      mimeType: file?.type || null,
    });
  };

  const buildDraftPayload = async () => {
    if (!contactId) throw new Error("Contact not found");

    const preparedSources = await Promise.all(
      charterSources.map(async (source) => {
        const title = sanitizeSourceTitle(source.title);
        const inputMode = source.inputMode;

        if (inputMode === "text") {
          const contentText = sanitizeSourceText(source.contentText);
          if (!contentText) throw new Error(`Add text for ${title}`);
          return {
            sourceKind: source.sourceKind,
            title,
            inputMode,
            contentText,
          };
        }

        if (inputMode === "url") {
          const sourceUrl = sanitizeSourceUrl(source.sourceUrl);
          if (!sourceUrl || !isValidSourceUrl(sourceUrl)) {
            throw new Error(`Enter a valid HTTPS link for ${title}`);
          }
          return {
            sourceKind: source.sourceKind,
            title,
            inputMode,
            sourceUrl,
          };
        }

        let storagePath = source.storedPath;
        let fileName = source.fileName;
        let mimeType = source.mimeType;

        if (source.file) {
          storagePath = await uploadCharterSourceFile(contactId, source.file);
          fileName = source.file.name;
          mimeType = source.file.type || source.mimeType || undefined;
          updateSource(source.id, { storedPath: storagePath, fileName, mimeType });
        }

        if (!storagePath) throw new Error(`Upload a file for ${title}`);

        return {
          sourceKind: source.sourceKind,
          title,
          inputMode,
          storagePath,
          fileName,
          mimeType,
        };
      })
    );

    return {
      contactId,
      charterId: charter?.id,
      sources: preparedSources,
    };
  };

  const generateDraft = async () => {
    if (!contactId) return;
    setDrafting(true);
    try {
      const payload = await buildDraftPayload();
      const data = await draftSovereigntyCharter(payload);

      if (data?.charter) {
        const savedCharter = data.charter as Record<string, unknown>;
        setCharter((current) => current ? {
          ...current,
          ...savedCharter,
          id: typeof savedCharter.id === "string" ? savedCharter.id : current.id,
          custom_sections: normalizeCustomSections(savedCharter.custom_sections),
        } : current);
      }

      if (Array.isArray(data?.sources)) {
        setCharterSources((data.sources as CharterSourceRecord[]).map((source) => ({
          id: source.id,
          sourceKind: source.source_kind,
          title: source.title,
          inputMode: source.input_mode,
          contentText: source.content_text || source.extracted_text || "",
          sourceUrl: source.source_url || "",
          file: null,
          storedPath: source.storage_path,
          fileName: source.file_name,
          mimeType: source.mime_type,
        })));
      }

      toast.success(data?.summary || "Initial charter draft generated");
      setEditing(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate charter draft");
    } finally {
      setDrafting(false);
    }
  };

  const ratifyCharter = async () => {
    if (!charter?.id || !contactId) {
      toast.error("Save or generate the charter before ratifying it");
      return;
    }

    setRatifying(true);
    const ratifiedAt = new Date().toISOString();
    const footerDateLabel = formatDate(ratifiedAt);
    const footerStatus = "Ratified / Sovereign phase";

    const { error: charterError } = await supabase
      .from("sovereignty_charters" as any)
      .update({
        draft_status: "ratified",
        ratified_at: ratifiedAt,
        ratified_by: user?.id || null,
        footer_status: footerStatus,
        footer_date_label: footerDateLabel,
      })
      .eq("id", charter.id);

    if (charterError) {
      setRatifying(false);
      toast.error(charterError.message);
      return;
    }

    const { error: contactError } = await supabase
      .from("contacts")
      .update({ charter_url: `/sovereignty-charter/contact/${contactId}` })
      .eq("id", contactId);

    setRatifying(false);

    if (contactError) {
      toast.error(contactError.message);
      return;
    }

    toast.success("Charter ratified and linked to the portal");
    await load();
  };

  const save = async () => {
    if (!charter || !contactId) return;
    setSaving(true);

    const payload = {
      contact_id: contactId,
      title: charter.title,
      subtitle: charter.subtitle,
      intro_heading: charter.intro_heading,
      intro_callout: charter.intro_callout,
      intro_note: charter.intro_note,
      mission_of_capital: charter.mission_of_capital,
      vision_20_year: charter.vision_20_year,
      governance_authority: charter.governance_authority,
      conflict_resolution: charter.conflict_resolution,
      fiduciary_alliance: charter.fiduciary_alliance,
      quiet_period: charter.quiet_period,
      architecture_intro: charter.architecture_intro,
      protected_assets_note: charter.protected_assets_note,
      harvest_accounts_note: charter.harvest_accounts_note,
      appendix_note: charter.appendix_note,
      footer_status: charter.footer_status,
      footer_date_label: charter.footer_date_label,
      custom_sections: charter.custom_sections,
    };

    const query = charter.id
      ? supabase.from("sovereignty_charters" as any).update(payload).eq("id", charter.id)
      : supabase.from("sovereignty_charters" as any).insert(payload).select("id").single();

    const { data, error } = await query;
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const insertedCharter = data as { id?: string } | null;

    if (!charter.id && insertedCharter?.id) {
      setCharter((current) => (current ? { ...current, id: insertedCharter.id } : current));
    }

    toast.success("Sovereignty Charter saved");
    setEditing(false);
    load();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contact || !charter) {
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
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); load(); }}>
                  Cancel
                </Button>
                <Button size="sm" variant="outline" onClick={generateDraft} disabled={saving || drafting}>
                  {drafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                  Generate draft
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={generateDraft} disabled={drafting}>
                  {drafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Refresh with AI
                </Button>
                <Button size="sm" onClick={ratifyCharter} disabled={ratifying || charter.draft_status === "ratified"}>
                  {ratifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {charter.draft_status === "ratified" ? "Ratified" : "Ratify charter"}
                </Button>
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
              </>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <div className="mx-auto max-w-[1100px] px-6 py-6 print:hidden">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">AI drafting workflow</p>
                    <p className="text-sm text-muted-foreground">Upload statements, paste Stabilization Session notes, or add Gemini transcript links before generating the first charter draft.</p>
                  </div>
                  <div className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                    Status: {charter.draft_status || "draft"}
                  </div>
                </div>
                {charter.generation_summary ? (
                  <p className="mt-3 text-sm text-muted-foreground">{charter.generation_summary}</p>
                ) : null}
              </div>

              <CharterSourceEditor
                sources={charterSources}
                onAdd={addSource}
                onRemove={removeSource}
                onUpdate={updateSource}
                onFileChange={handleSourceFileChange}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Document Title">
                  <Input value={charter.title} onChange={(e) => updateField("title", e.target.value)} />
                </Field>
                <Field label="Subtitle">
                  <Input value={charter.subtitle} onChange={(e) => updateField("subtitle", e.target.value)} />
                </Field>
              </div>

              <Field label="Intro Heading">
                <Textarea value={charter.intro_heading} onChange={(e) => updateField("intro_heading", e.target.value)} rows={2} />
              </Field>
              <Field label="Intro Callout">
                <Textarea value={charter.intro_callout} onChange={(e) => updateField("intro_callout", e.target.value)} rows={4} />
              </Field>
              <Field label="Intro Note">
                <Textarea value={charter.intro_note} onChange={(e) => updateField("intro_note", e.target.value)} rows={3} />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Mission of Capital">
                  <Textarea value={charter.mission_of_capital} onChange={(e) => updateField("mission_of_capital", e.target.value)} rows={5} />
                </Field>
                <Field label="20-Year Vision">
                  <Textarea value={charter.vision_20_year} onChange={(e) => updateField("vision_20_year", e.target.value)} rows={5} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Governance & Authority">
                  <Textarea value={charter.governance_authority} onChange={(e) => updateField("governance_authority", e.target.value)} rows={5} />
                </Field>
                <Field label="Conflict Resolution & Representation">
                  <Textarea value={charter.conflict_resolution} onChange={(e) => updateField("conflict_resolution", e.target.value)} rows={5} />
                </Field>
                <Field label="Fiduciary Alliance">
                  <Textarea value={charter.fiduciary_alliance} onChange={(e) => updateField("fiduciary_alliance", e.target.value)} rows={5} />
                </Field>
                <Field label="Secondary Quiet Period">
                  <Textarea value={charter.quiet_period} onChange={(e) => updateField("quiet_period", e.target.value)} rows={5} />
                </Field>
              </div>
            </div>

            <div className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-sm">
              <Field label="Architecture Intro">
                <Textarea value={charter.architecture_intro} onChange={(e) => updateField("architecture_intro", e.target.value)} rows={4} />
              </Field>
              <Field label="Protected Assets Empty State">
                <Textarea value={charter.protected_assets_note} onChange={(e) => updateField("protected_assets_note", e.target.value)} rows={3} />
              </Field>
              <Field label="Harvest Accounts Empty State">
                <Textarea value={charter.harvest_accounts_note} onChange={(e) => updateField("harvest_accounts_note", e.target.value)} rows={3} />
              </Field>
              <Field label="Appendix Note">
                <Textarea value={charter.appendix_note} onChange={(e) => updateField("appendix_note", e.target.value)} rows={3} />
              </Field>
              <Field label="Footer Status">
                <Input value={charter.footer_status} onChange={(e) => updateField("footer_status", e.target.value)} />
              </Field>
              <Field label="Footer Date Label">
                <Input value={charter.footer_date_label} onChange={(e) => updateField("footer_date_label", e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <CustomContainerEditor
              title="Page 1 Additional Containers"
              description="These render as constitutional article cards on Page 1."
              emptyLabel="No Page 1 containers yet."
              sections={charter.custom_sections.pageOne}
              onAdd={() => addCustomContainer("pageOne")}
              onRemove={(id) => removeCustomContainer("pageOne", id)}
              onUpdate={(id, key, value) => updateCustomContainer("pageOne", id, key, value)}
            />
            <CustomContainerEditor
              title="Page 2 Additional Containers"
              description="These render as architecture containers on Page 2."
              emptyLabel="No Page 2 containers yet."
              sections={charter.custom_sections.pageTwo}
              onAdd={() => addCustomContainer("pageTwo")}
              onRemove={(id) => removeCustomContainer("pageTwo", id)}
              onUpdate={(id, key, value) => updateCustomContainer("pageTwo", id, key, value)}
            />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[210mm] px-6 py-6 print:p-0 print:max-w-none">
        {(charter.generation_summary || charter.last_generated_at || charter.ratified_at) && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Draft lifecycle</p>
                <p className="text-sm text-muted-foreground">{charter.generation_summary || "This charter is ready for review and ratification."}</p>
              </div>
              <div className="space-y-1 text-right text-xs text-muted-foreground">
                {charter.last_generated_at ? <div>Last AI draft: {formatDate(charter.last_generated_at, charter.last_generated_at)}</div> : null}
                {charter.ratified_at ? <div>Ratified: {formatDate(charter.ratified_at, charter.ratified_at)}</div> : null}
              </div>
            </div>
          </div>
        )}

        <div className={pageWrap} style={pageStyle}>
          <div style={{ backgroundColor: "#2A4034", color: "#fff", padding: "10mm 12mm 9mm" }}>
            <img src={pwLogoWhite} alt="ProsperWise" style={{ width: "54mm", height: "auto", display: "block", marginBottom: "4mm" }} />
            <div style={{ fontSize: "8pt", fontWeight: 300, color: "rgba(255,255,255,.55)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "4mm" }}>
              Sovereignty Operating System
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24pt", fontWeight: 300, lineHeight: 1.08 }}>
              {charter.title}
            </div>
            <div style={{ fontSize: "8pt", color: "rgba(255,255,255,.7)", marginTop: "2.5mm" }}>
              {charter.subtitle}
            </div>
          </div>

          <div style={{ padding: "12mm", display: "flex", flexDirection: "column", gap: "6mm" }}>
            <div>
              <div style={{ fontSize: "7.5pt", letterSpacing: ".1em", textTransform: "uppercase", color: "#7a8a8a", marginBottom: "1.5mm" }}>
                Sovereignty Charter &nbsp;·&nbsp; Prepared for <strong>{fullName}</strong>
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "25pt", fontWeight: 300, color: "#3B3F3F", lineHeight: 1.1, whiteSpace: "pre-line" }}>
                {charter.intro_heading}
              </div>
              <hr style={{ width: "18mm", height: "3px", background: "#A98C5A", border: "none", marginTop: "2.5mm" }} />
            </div>

            <div style={{ background: "#F8F6F2", borderLeft: "3px solid #A98C5A", padding: "3mm 5mm", display: "flex", flexDirection: "column", gap: "1.5mm" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "7.5pt", fontWeight: 400, fontStyle: "italic", color: "#3B3F3F", lineHeight: 1.55 }}>
                {charter.intro_callout}
              </div>
              <div style={{ fontSize: "7.5pt", color: "#3B3F3F" }}>
                {charter.intro_note}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm" }}>
              <SectionCard title="Mission of Capital" body={charter.mission_of_capital} />
              <SectionCard title="20-Year Vision" body={charter.vision_20_year} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm" }}>
              <ArticleCard title="Governance & Authority" body={charter.governance_authority} />
              <ArticleCard title="Conflict Resolution & Representation" body={charter.conflict_resolution} />
              <ArticleCard title="Fiduciary Alliance" body={charter.fiduciary_alliance} />
              <ArticleCard title="Secondary Quiet Period" body={charter.quiet_period} />
            </div>

            {charter.custom_sections.pageOne.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm" }}>
                {charter.custom_sections.pageOne.map((section) => (
                  <PageOneContainerCard
                    key={`page-one-${section.id}`}
                    title={section.title}
                    meta={section.meta}
                    body={section.body}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ background: "#A98C5A", color: "#fff", marginTop: "auto", padding: "3mm 12mm", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "8.5pt", fontWeight: 500, maxWidth: "75%" }}>
              Ratification status: {charter.footer_status}
            </div>
            <div style={{ fontSize: "7.5pt", opacity: 0.9 }}>{charter.footer_date_label}</div>
          </div>
        </div>

        <div className={`${pageWrap} print-page-break`} style={{ ...pageStyle, marginTop: "6mm" }}>
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
                {charter.architecture_intro}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4mm" }}>
              <ContainerCard
                title="The Vineyard"
                subtitle="Protected Principal & Harvest Accounts"
                meta={`Tracked value ${formatCurrency(vineyardAccounts.reduce((sum, account) => sum + (account.current_value || 0), 0))}`}
                items={vineyardAccounts.length
                  ? vineyardAccounts.map((account) => `${account.account_name}${account.account_number ? ` (${account.account_number})` : ""} · ${formatCurrency(account.current_value)} · ${isProtectedAccount(account) ? "Protected" : "Eligible Harvest"}`)
                  : [charter.protected_assets_note, charter.harvest_accounts_note]}
              />

              {STOREHOUSE_CONFIG.map(({ num, name, subtitle }) => {
                const containerAccounts = storehouses.filter((storehouse) => storehouse.storehouse_number === num);
                const containerValue = containerAccounts.reduce((sum, storehouse) => sum + (storehouse.current_value || 0), 0);

                return (
                  <ContainerCard
                    key={name}
                    title={name}
                    subtitle={subtitle}
                    meta={`Tracked value ${formatCurrency(containerValue)}`}
                    items={containerAccounts.length
                      ? containerAccounts.flatMap((storehouse) => {
                          const rules = groupedRules[storehouse.label] || groupedRules[`Storehouse ${storehouse.storehouse_number}`] || [];
                          const detail = `${storehouse.label} · ${formatCurrency(storehouse.current_value)}${storehouse.target_value != null ? ` · Target ${formatCurrency(storehouse.target_value)}` : ""}`;
                          const notes = rules.length
                            ? rules.map((rule) => rule.rule_description)
                            : [storehouse.asset_type, storehouse.risk_cap ? `Risk cap: ${storehouse.risk_cap}` : null, storehouse.notes]
                                .filter(Boolean) as string[];

                          return [detail, ...notes];
                        })
                      : ["No accounts currently designated to this container."]}
                  />
                );
              })}

              {charter.custom_sections.pageTwo.map((section) => (
                <ContainerCard
                  key={section.id}
                  title={section.title}
                  meta={section.meta}
                  items={section.body.split("\n").map((line) => line.trim()).filter(Boolean)}
                />
              ))}
            </div>

            <SectionCard
              title="Sovereign Waterfall"
              body={waterfallPriorities.length ? undefined : "Waterfall priorities have not yet been defined for this family."}
              items={waterfallPriorities.map((priority) => `${priority.priority_order}. ${priority.priority_label}${priority.target_amount ? ` · ${formatCurrency(priority.target_amount)}` : ""}${priority.priority_description ? ` — ${priority.priority_description}` : ""}`)}
            />
          </div>
        </div>

        <div className={`${pageWrap} print-page-break`} style={{ ...pageStyle, marginTop: "6mm" }}>
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
              {charter.appendix_note}
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
              rows={[
                ...storehouses.map((storehouse) => ({
                  label: storehouse.label,
                  type: storehouse.asset_type || `Storehouse #${storehouse.storehouse_number}`,
                  value: formatCurrency(storehouse.current_value),
                  note: storehouse.risk_cap || storehouse.notes || "Governed reserve",
                })),
                ...charter.custom_sections.pageOne.map((section) => ({
                  label: section.title,
                  type: "Page 1 Additional Container",
                  value: "—",
                  note: section.meta || "Custom page 1 governance container",
                })),
                ...charter.custom_sections.pageTwo.map((section) => ({
                  label: section.title,
                  type: "Page 2 Additional Container",
                  value: "—",
                  note: section.meta || "Custom page 2 governance container",
                })),
              ]}
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

const pageStyle: React.CSSProperties = {
  width: "210mm",
  minHeight: "297mm",
  display: "flex",
  flexDirection: "column",
  fontFamily: "'DM Sans', sans-serif",
  color: "#3B3F3F",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CustomContainerEditor({
  title,
  description,
  emptyLabel,
  sections,
  onAdd,
  onRemove,
  onUpdate,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  sections: CustomContainer[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, key: keyof CustomContainer, value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add container
        </Button>
      </div>

      <div className="space-y-4">
        {sections.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          sections.map((section, index) => (
            <div key={section.id} className="rounded-md border border-border p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">Container {index + 1}</div>
                <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(section.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Container Title">
                  <Input value={section.title} onChange={(e) => onUpdate(section.id, "title", e.target.value)} />
                </Field>
                <Field label="Meta Line">
                  <Input value={section.meta} onChange={(e) => onUpdate(section.id, "meta", e.target.value)} placeholder="Current $0 · Target $0" />
                </Field>
              </div>
              <Field label="Container Guidance">
                <Textarea
                  value={section.body}
                  onChange={(e) => onUpdate(section.id, "body", e.target.value)}
                  rows={4}
                  placeholder="One line per rule or guidance note"
                />
              </Field>
            </div>
          ))
        )}
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

function PageOneContainerCard({ title, meta, body }: { title: string; meta?: string; body: string }) {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div style={{ border: "1px solid #D3C5B7", padding: "4mm", background: "#fff" }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "13pt", fontWeight: 500, color: "#3B3F3F", marginBottom: "1.5mm" }}>{title}</div>
      {meta ? <div style={{ fontSize: "7pt", color: "#6B7070", marginBottom: "2mm", textTransform: "uppercase", letterSpacing: ".08em" }}>{meta}</div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5mm" }}>
        {lines.map((line, index) => (
          <p key={index} style={{ fontSize: "7.5pt", lineHeight: 1.6, color: "#3B3F3F" }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function ContainerCard({
  title,
  meta,
  subtitle,
  items,
}: {
  title: string;
  meta?: string;
  subtitle?: string;
  items: string[];
}) {
  return (
    <div style={{ background: "#F8F6F2", borderLeft: "3px solid #A98C5A", padding: "3mm 4mm" }}>
      <strong style={{ display: "block", fontSize: "8.5pt", fontWeight: 600, color: "#3B3F3F", marginBottom: "1mm" }}>{title}</strong>
      {meta ? <div style={{ fontSize: "7.5pt", color: "#6B7070", marginBottom: "1.5mm" }}>{meta}</div> : null}
      {subtitle ? <div style={{ fontSize: "7.5pt", color: "#3B3F3F", marginBottom: "1.5mm" }}>{subtitle}</div> : null}
      {items.map((item, index) => (
        <div key={index} style={{ display: "flex", gap: "2mm", marginTop: "1.2mm" }}>
          <div style={{ width: "4px", height: "4px", borderRadius: "999px", background: "#A98C5A", marginTop: "5px", flexShrink: 0 }} />
          <p style={{ fontSize: "7.5pt", lineHeight: 1.5 }}>{item}</p>
        </div>
      ))}
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

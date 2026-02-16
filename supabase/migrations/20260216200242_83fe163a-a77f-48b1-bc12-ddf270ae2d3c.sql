
-- Storehouse funding rules extracted from charters
CREATE TABLE public.storehouse_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  storehouse_label TEXT NOT NULL,
  storehouse_number INTEGER NOT NULL,
  rule_type TEXT NOT NULL, -- 'funding_floor', 'funding_ceiling', 'governance_clause', 'quiet_period'
  rule_description TEXT NOT NULL,
  rule_value NUMERIC,
  rule_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.storehouse_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view storehouse rules" ON public.storehouse_rules FOR SELECT USING (true);
CREATE POLICY "Advisors can insert storehouse rules" ON public.storehouse_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Advisors can update storehouse rules" ON public.storehouse_rules FOR UPDATE USING (true);
CREATE POLICY "Advisors can delete storehouse rules" ON public.storehouse_rules FOR DELETE USING (true);

CREATE TRIGGER update_storehouse_rules_updated_at
  BEFORE UPDATE ON public.storehouse_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sovereign Waterfall priority allocation extracted from charters
CREATE TABLE public.waterfall_priorities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  priority_order INTEGER NOT NULL,
  priority_label TEXT NOT NULL,
  priority_description TEXT,
  target_amount NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, priority_order)
);

ALTER TABLE public.waterfall_priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view waterfall priorities" ON public.waterfall_priorities FOR SELECT USING (true);
CREATE POLICY "Advisors can insert waterfall priorities" ON public.waterfall_priorities FOR INSERT WITH CHECK (true);
CREATE POLICY "Advisors can update waterfall priorities" ON public.waterfall_priorities FOR UPDATE USING (true);
CREATE POLICY "Advisors can delete waterfall priorities" ON public.waterfall_priorities FOR DELETE USING (true);

CREATE TRIGGER update_waterfall_priorities_updated_at
  BEFORE UPDATE ON public.waterfall_priorities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add account_number column to vineyard_accounts for charter extraction
ALTER TABLE public.vineyard_accounts ADD COLUMN IF NOT EXISTS account_number TEXT;


-- Corporation entity types
CREATE TYPE public.corporation_type AS ENUM ('opco', 'holdco', 'trust', 'partnership', 'other');

-- Corporations table
CREATE TABLE public.corporations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  corporation_type public.corporation_type NOT NULL DEFAULT 'opco',
  jurisdiction TEXT,
  fiscal_year_end TEXT,
  asana_project_url TEXT,
  sidedrawer_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Shareholders bridge table (Individual <-> Corporation)
CREATE TABLE public.shareholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  corporation_id UUID NOT NULL REFERENCES public.corporations(id) ON DELETE CASCADE,
  ownership_percentage NUMERIC NOT NULL DEFAULT 0 CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
  share_class TEXT DEFAULT 'Common',
  role_title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (contact_id, corporation_id)
);

-- Corporate vineyard accounts (assets owned by the corporation)
CREATE TABLE public.corporate_vineyard_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corporation_id UUID NOT NULL REFERENCES public.corporations(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_number TEXT,
  account_type TEXT NOT NULL DEFAULT 'Portfolio',
  current_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.corporations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_vineyard_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for corporations
CREATE POLICY "Advisors can view corporations" ON public.corporations FOR SELECT USING (true);
CREATE POLICY "Advisors can insert corporations" ON public.corporations FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Advisors can update corporations" ON public.corporations FOR UPDATE USING (true);
CREATE POLICY "Advisors can delete corporations" ON public.corporations FOR DELETE USING (true);

-- RLS Policies for shareholders
CREATE POLICY "Advisors can view shareholders" ON public.shareholders FOR SELECT USING (true);
CREATE POLICY "Advisors can insert shareholders" ON public.shareholders FOR INSERT WITH CHECK (true);
CREATE POLICY "Advisors can update shareholders" ON public.shareholders FOR UPDATE USING (true);
CREATE POLICY "Advisors can delete shareholders" ON public.shareholders FOR DELETE USING (true);

-- RLS Policies for corporate_vineyard_accounts
CREATE POLICY "Advisors can view corporate vineyard" ON public.corporate_vineyard_accounts FOR SELECT USING (true);
CREATE POLICY "Advisors can insert corporate vineyard" ON public.corporate_vineyard_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Advisors can update corporate vineyard" ON public.corporate_vineyard_accounts FOR UPDATE USING (true);
CREATE POLICY "Advisors can delete corporate vineyard" ON public.corporate_vineyard_accounts FOR DELETE USING (true);

-- Updated_at triggers
CREATE TRIGGER update_corporations_updated_at BEFORE UPDATE ON public.corporations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shareholders_updated_at BEFORE UPDATE ON public.shareholders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_corporate_vineyard_updated_at BEFORE UPDATE ON public.corporate_vineyard_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

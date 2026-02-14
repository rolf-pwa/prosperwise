
-- Profiles table for advisor data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Contacts table (The Sovereignty Engine)
CREATE TYPE public.governance_status AS ENUM ('stabilization', 'sovereign');
CREATE TYPE public.fiduciary_entity AS ENUM ('pws', 'pwa');

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Standard Fields
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  household_members JSONB DEFAULT '[]'::jsonb,
  
  -- Professional Team
  lawyer_name TEXT,
  lawyer_firm TEXT,
  accountant_name TEXT,
  accountant_firm TEXT,
  
  -- Governance
  governance_status public.governance_status NOT NULL DEFAULT 'stabilization',
  fiduciary_entity public.fiduciary_entity NOT NULL DEFAULT 'pws',
  
  -- The Vineyard (Entity Data)
  vineyard_ebitda NUMERIC,
  vineyard_operating_income NUMERIC,
  vineyard_balance_sheet_summary TEXT,
  
  -- Quiet Period
  quiet_period_start_date DATE,
  
  -- Resource Links
  sidedrawer_url TEXT,
  asana_url TEXT,
  ia_financial_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- All authenticated advisors can access all contacts (small team)
CREATE POLICY "Advisors can view all contacts"
  ON public.contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Advisors can insert contacts"
  ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Advisors can update all contacts"
  ON public.contacts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Advisors can delete contacts"
  ON public.contacts FOR DELETE TO authenticated USING (true);

-- The 4 Storehouses (Liquidity Vessels)
CREATE TYPE public.charter_alignment AS ENUM ('aligned', 'misaligned', 'pending_review');

CREATE TABLE public.storehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  storehouse_number INT NOT NULL CHECK (storehouse_number BETWEEN 1 AND 4),
  label TEXT NOT NULL DEFAULT '',
  asset_type TEXT,
  risk_cap TEXT,
  charter_alignment public.charter_alignment NOT NULL DEFAULT 'pending_review',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, storehouse_number)
);

ALTER TABLE public.storehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view all storehouses"
  ON public.storehouses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Advisors can insert storehouses"
  ON public.storehouses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Advisors can update storehouses"
  ON public.storehouses FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Advisors can delete storehouses"
  ON public.storehouses FOR DELETE TO authenticated USING (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_storehouses_updated_at
  BEFORE UPDATE ON public.storehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

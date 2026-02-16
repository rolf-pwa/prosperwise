
-- Phase 1: Sovereignty Tree Schema

-- 1. Family role enum
CREATE TYPE public.family_role AS ENUM ('head_of_family', 'spouse', 'beneficiary', 'minor');

-- 2. Fee tier enum
CREATE TYPE public.fee_tier AS ENUM ('sovereign', 'legacy', 'dynasty');

-- 3. Visibility scope enum
CREATE TYPE public.visibility_scope AS ENUM ('private', 'household_shared', 'family_shared');

-- 4. Families table (top-level entity)
CREATE TABLE public.families (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  charter_document_url TEXT,
  fee_tier public.fee_tier NOT NULL DEFAULT 'sovereign',
  fee_tier_discount_pct NUMERIC NOT NULL DEFAULT 0,
  total_family_assets NUMERIC NOT NULL DEFAULT 0,
  annual_savings NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view all families" ON public.families FOR SELECT USING (true);
CREATE POLICY "Advisors can insert families" ON public.families FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Advisors can update families" ON public.families FOR UPDATE USING (true);
CREATE POLICY "Advisors can delete families" ON public.families FOR DELETE USING (true);

CREATE TRIGGER update_families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Households table (sub-collection of family)
CREATE TABLE public.households (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Primary',
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view all households" ON public.households FOR SELECT USING (true);
CREATE POLICY "Advisors can insert households" ON public.households FOR INSERT WITH CHECK (true);
CREATE POLICY "Advisors can update households" ON public.households FOR UPDATE USING (true);
CREATE POLICY "Advisors can delete households" ON public.households FOR DELETE USING (true);

CREATE TRIGGER update_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Extend contacts with hierarchy fields
ALTER TABLE public.contacts
  ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  ADD COLUMN household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  ADD COLUMN family_role public.family_role NOT NULL DEFAULT 'head_of_family',
  ADD COLUMN is_minor BOOLEAN NOT NULL DEFAULT false;

-- 7. Add visibility_scope to asset tables
ALTER TABLE public.vineyard_accounts
  ADD COLUMN visibility_scope public.visibility_scope NOT NULL DEFAULT 'private';

ALTER TABLE public.storehouses
  ADD COLUMN visibility_scope public.visibility_scope NOT NULL DEFAULT 'private';

-- 8. Auto-migrate: Create a family + household for each existing contact
DO $$
DECLARE
  rec RECORD;
  new_family_id UUID;
  new_household_id UUID;
BEGIN
  FOR rec IN SELECT id, full_name, address, created_by FROM public.contacts WHERE family_id IS NULL
  LOOP
    -- Create family
    INSERT INTO public.families (name, created_by)
    VALUES (rec.full_name || ' Family', rec.created_by)
    RETURNING id INTO new_family_id;

    -- Create primary household
    INSERT INTO public.households (family_id, label, address)
    VALUES (new_family_id, 'Primary', rec.address)
    RETURNING id INTO new_household_id;

    -- Link contact
    UPDATE public.contacts
    SET family_id = new_family_id, household_id = new_household_id
    WHERE id = rec.id;
  END LOOP;
END;
$$;

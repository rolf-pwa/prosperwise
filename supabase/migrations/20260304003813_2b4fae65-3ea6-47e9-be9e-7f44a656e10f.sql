
-- Add governance columns to households table
ALTER TABLE public.households 
  ADD COLUMN governance_status public.governance_status NOT NULL DEFAULT 'stabilization',
  ADD COLUMN fiduciary_entity public.fiduciary_entity NOT NULL DEFAULT 'pws',
  ADD COLUMN quiet_period_start_date date NULL;

-- Seed household governance from the Head of Family contact in each household
UPDATE public.households h
SET 
  governance_status = c.governance_status,
  fiduciary_entity = c.fiduciary_entity,
  quiet_period_start_date = c.quiet_period_start_date
FROM public.contacts c
WHERE c.household_id = h.id
  AND c.family_role = 'head_of_family';

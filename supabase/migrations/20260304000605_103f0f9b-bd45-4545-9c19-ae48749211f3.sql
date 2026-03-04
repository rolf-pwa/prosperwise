
-- Add head_of_household to the family_role enum
ALTER TYPE public.family_role ADD VALUE IF NOT EXISTS 'head_of_household';

-- Add per-household flag controlling whether HoF can see into this household
ALTER TABLE public.households
ADD COLUMN hof_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.households.hof_visible IS 'When false, Head of Family cannot drill into this household from the family view';

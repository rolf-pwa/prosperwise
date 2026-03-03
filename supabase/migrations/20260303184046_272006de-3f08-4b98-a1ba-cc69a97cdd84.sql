
ALTER TABLE public.marketing_updates
ADD COLUMN target_contact_ids uuid[] DEFAULT '{}',
ADD COLUMN target_household_ids uuid[] DEFAULT '{}';


-- Add first_name and last_name columns
ALTER TABLE public.contacts ADD COLUMN first_name text;
ALTER TABLE public.contacts ADD COLUMN last_name text;

-- Migrate existing data: split full_name into first/last
UPDATE public.contacts SET
  first_name = split_part(full_name, ' ', 1),
  last_name = CASE 
    WHEN position(' ' in full_name) > 0 THEN substring(full_name from position(' ' in full_name) + 1)
    ELSE ''
  END;

-- Make first_name NOT NULL after migration
ALTER TABLE public.contacts ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE public.contacts ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE public.contacts ALTER COLUMN last_name SET DEFAULT '';

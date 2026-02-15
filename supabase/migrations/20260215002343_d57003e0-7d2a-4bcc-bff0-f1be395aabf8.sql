
ALTER TABLE public.contacts
  ADD COLUMN executor_name TEXT,
  ADD COLUMN executor_firm TEXT,
  ADD COLUMN poa_name TEXT,
  ADD COLUMN poa_firm TEXT;

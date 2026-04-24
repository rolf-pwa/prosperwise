
ALTER TABLE public.sovereignty_charters
  ADD COLUMN IF NOT EXISTS esign_initiated_by uuid;

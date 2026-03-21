ALTER TABLE public.marketing_updates
  ADD COLUMN scheduled_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN sent boolean NOT NULL DEFAULT true;
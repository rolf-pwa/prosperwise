ALTER TABLE public.georgia_analytics_sync_configs
ADD COLUMN IF NOT EXISTS worksheet_abandoned_name text NOT NULL DEFAULT 'Abandoned Sessions';
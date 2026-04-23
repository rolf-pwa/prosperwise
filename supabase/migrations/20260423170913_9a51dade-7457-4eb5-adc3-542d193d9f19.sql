CREATE TABLE public.georgia_analytics_sync_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination_type TEXT NOT NULL DEFAULT 'google_sheets',
  spreadsheet_id TEXT NOT NULL,
  worksheet_summary_name TEXT NOT NULL DEFAULT 'Georgia Daily Summary',
  worksheet_traffic_name TEXT NOT NULL DEFAULT 'Georgia Traffic Context',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT georgia_analytics_sync_configs_destination_check CHECK (destination_type = 'google_sheets')
);

ALTER TABLE public.georgia_analytics_sync_configs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_georgia_analytics_sync_configs_updated_at
BEFORE UPDATE ON public.georgia_analytics_sync_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff can view Georgia analytics sync config"
ON public.georgia_analytics_sync_configs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can update Georgia analytics sync config"
ON public.georgia_analytics_sync_configs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Service can manage Georgia analytics sync config"
ON public.georgia_analytics_sync_configs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
ALTER TABLE public.sovereignty_charter_sources
ADD COLUMN IF NOT EXISTS import_origin TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS external_file_id TEXT,
ADD COLUMN IF NOT EXISTS external_modified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS external_folder_id TEXT,
ADD COLUMN IF NOT EXISTS sync_error TEXT;

CREATE INDEX IF NOT EXISTS idx_sovereignty_charter_sources_contact_external_file
ON public.sovereignty_charter_sources (contact_id, external_file_id);

CREATE INDEX IF NOT EXISTS idx_sovereignty_charter_sources_contact_origin
ON public.sovereignty_charter_sources (contact_id, import_origin);

ALTER TABLE public.drive_watch_state
ADD COLUMN IF NOT EXISTS charter_last_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS charter_last_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS charter_folder_id TEXT,
ADD COLUMN IF NOT EXISTS charter_sync_status TEXT NOT NULL DEFAULT 'idle';

CREATE INDEX IF NOT EXISTS idx_drive_watch_state_charter_folder_id
ON public.drive_watch_state (charter_folder_id);
DELETE FROM public.sovereignty_charter_sources
WHERE contact_id IN (SELECT id FROM public.contacts WHERE first_name ILIKE 'Colleen')
  AND import_origin = 'google_drive_sync';

UPDATE public.drive_watch_state
SET charter_last_synced_at = NULL,
    charter_sync_status = 'idle',
    updated_at = now()
WHERE contact_id IN (SELECT id FROM public.contacts WHERE first_name ILIKE 'Colleen');
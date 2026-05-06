
-- Promote vault to household level
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS vault_root_folder_id text;

-- Backfill household vault from any member contact that already has one
UPDATE public.households h
SET vault_root_folder_id = sub.vault_root_folder_id
FROM (
  SELECT DISTINCT ON (household_id) household_id, vault_root_folder_id
  FROM public.contacts
  WHERE household_id IS NOT NULL AND vault_root_folder_id IS NOT NULL
  ORDER BY household_id, updated_at DESC
) sub
WHERE h.id = sub.household_id
  AND h.vault_root_folder_id IS NULL;

-- Re-scope collaborators & guest-access to households
ALTER TABLE public.vault_collaborators
  ADD COLUMN IF NOT EXISTS household_id uuid;

UPDATE public.vault_collaborators vc
SET household_id = c.household_id
FROM public.contacts c
WHERE vc.contact_id = c.id AND vc.household_id IS NULL;

ALTER TABLE public.vault_audit_log
  ADD COLUMN IF NOT EXISTS household_id uuid;

ALTER TABLE public.vault_files
  ADD COLUMN IF NOT EXISTS household_id uuid;

UPDATE public.vault_files vf
SET household_id = c.household_id
FROM public.contacts c
WHERE vf.contact_id = c.id AND vf.household_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_vault_collaborators_household ON public.vault_collaborators(household_id);
CREATE INDEX IF NOT EXISTS idx_vault_files_household ON public.vault_files(household_id);

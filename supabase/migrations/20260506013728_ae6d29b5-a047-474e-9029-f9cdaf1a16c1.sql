
ALTER TABLE public.vault_collaborators
  DROP CONSTRAINT IF EXISTS vault_collaborators_contact_id_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS vault_collaborators_household_email_key
  ON public.vault_collaborators(household_id, email);

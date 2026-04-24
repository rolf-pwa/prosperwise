
ALTER TABLE public.sovereignty_charters
  ADD COLUMN IF NOT EXISTS esign_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS esign_doc_id text,
  ADD COLUMN IF NOT EXISTS esign_doc_url text,
  ADD COLUMN IF NOT EXISTS esign_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS esign_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS esign_signed_pdf_path text,
  ADD COLUMN IF NOT EXISTS esign_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS esign_error text;

CREATE OR REPLACE FUNCTION public.validate_charter_esign_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.esign_status NOT IN ('not_sent','sent','signed','ratified','error') THEN
    RAISE EXCEPTION 'Invalid esign_status: %', NEW.esign_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_charter_esign_status_trg ON public.sovereignty_charters;
CREATE TRIGGER validate_charter_esign_status_trg
  BEFORE INSERT OR UPDATE OF esign_status ON public.sovereignty_charters
  FOR EACH ROW EXECUTE FUNCTION public.validate_charter_esign_status();

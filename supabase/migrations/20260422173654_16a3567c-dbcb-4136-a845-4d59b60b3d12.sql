CREATE TABLE public.sovereignty_charters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  title TEXT,
  subtitle TEXT,
  intro_heading TEXT,
  intro_callout TEXT,
  intro_note TEXT,
  mission_of_capital TEXT,
  vision_20_year TEXT,
  governance_authority TEXT,
  conflict_resolution TEXT,
  fiduciary_alliance TEXT,
  quiet_period TEXT,
  architecture_intro TEXT,
  protected_assets_note TEXT,
  harvest_accounts_note TEXT,
  appendix_note TEXT,
  footer_status TEXT,
  footer_date_label TEXT,
  custom_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_id)
);

ALTER TABLE public.sovereignty_charters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view sovereignty charters"
ON public.sovereignty_charters
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can create sovereignty charters"
ON public.sovereignty_charters
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Staff can update sovereignty charters"
ON public.sovereignty_charters
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Staff can delete sovereignty charters"
ON public.sovereignty_charters
FOR DELETE
TO authenticated
USING (true);

CREATE TRIGGER update_sovereignty_charters_updated_at
BEFORE UPDATE ON public.sovereignty_charters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
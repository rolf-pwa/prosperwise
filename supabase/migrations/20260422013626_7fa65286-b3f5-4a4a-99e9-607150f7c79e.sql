CREATE TABLE public.quarterly_system_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  created_by uuid,
  review_date date DEFAULT CURRENT_DATE,
  generation_status text NOT NULL DEFAULT 'pending',
  generation_error text,
  logic_trace text,
  client_first_name text NOT NULL DEFAULT '',
  client_last_name text NOT NULL DEFAULT '',
  review_summary text NOT NULL DEFAULT '',
  alignment_overview text NOT NULL DEFAULT '',
  charter_status text NOT NULL DEFAULT 'Needs Review',
  charter_detail text NOT NULL DEFAULT '',
  vineyard_status text NOT NULL DEFAULT 'Needs Review',
  vineyard_detail text NOT NULL DEFAULT '',
  storehouse_status text NOT NULL DEFAULT 'Needs Review',
  storehouse_detail text NOT NULL DEFAULT '',
  cross_system_status text NOT NULL DEFAULT 'Needs Review',
  cross_system_detail text NOT NULL DEFAULT '',
  gap_1 text NOT NULL DEFAULT '',
  gap_2 text NOT NULL DEFAULT '',
  gap_3 text NOT NULL DEFAULT '',
  gap_4 text NOT NULL DEFAULT '',
  gap_5 text NOT NULL DEFAULT '',
  priority_1 text NOT NULL DEFAULT '',
  priority_2 text NOT NULL DEFAULT '',
  priority_3 text NOT NULL DEFAULT '',
  priority_4 text NOT NULL DEFAULT '',
  priority_5 text NOT NULL DEFAULT '',
  footer_note text NOT NULL DEFAULT 'Quarterly review to ensure the Charter, Vineyard, and Storehouse remain aligned and governable over the next 90 days.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quarterly_system_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view quarterly system reviews"
ON public.quarterly_system_reviews
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can insert quarterly system reviews"
ON public.quarterly_system_reviews
FOR INSERT
TO authenticated
WITH CHECK (created_by IS NULL OR auth.uid() = created_by);

CREATE POLICY "Staff can update quarterly system reviews"
ON public.quarterly_system_reviews
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (created_by IS NULL OR auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Staff can delete quarterly system reviews"
ON public.quarterly_system_reviews
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Service can insert quarterly system reviews"
ON public.quarterly_system_reviews
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service can update quarterly system reviews"
ON public.quarterly_system_reviews
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_quarterly_system_reviews_contact_id_created_at
ON public.quarterly_system_reviews (contact_id, created_at DESC);

CREATE TRIGGER update_quarterly_system_reviews_updated_at
BEFORE UPDATE ON public.quarterly_system_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Stabilization Maps table — stores the 25 fields rendered into the client-facing one-pager.
CREATE TABLE public.stabilization_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NULL REFERENCES public.discovery_leads(id) ON DELETE SET NULL,
  contact_id UUID NULL REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Client identity
  client_first_name TEXT NOT NULL DEFAULT '',
  client_last_name TEXT NOT NULL DEFAULT '',
  session_date DATE NULL,

  -- Event classification
  event_type TEXT NOT NULL DEFAULT 'Business Exit', -- Business Exit / Inheritance / Sudden Windfall / Taxable Event

  -- Situation narrative
  situation_summary TEXT NOT NULL DEFAULT '',
  urgency_flag TEXT NOT NULL DEFAULT '',

  -- Five risks
  risk_1 TEXT NOT NULL DEFAULT '',
  risk_2 TEXT NOT NULL DEFAULT '',
  risk_3 TEXT NOT NULL DEFAULT '',
  risk_4 TEXT NOT NULL DEFAULT '',
  risk_5 TEXT NOT NULL DEFAULT '',

  -- Five next steps
  next_step_1 TEXT NOT NULL DEFAULT '',
  next_step_2 TEXT NOT NULL DEFAULT '',
  next_step_3 TEXT NOT NULL DEFAULT '',
  next_step_4 TEXT NOT NULL DEFAULT '',
  next_step_5 TEXT NOT NULL DEFAULT '',

  -- Status cards
  storehouse_status TEXT NOT NULL DEFAULT 'Not Established',       -- Not Established / Partial / Established
  storehouse_detail TEXT NOT NULL DEFAULT '',
  solicitation_status TEXT NOT NULL DEFAULT 'Not Established',     -- Not Established / Partial / Established
  solicitation_detail TEXT NOT NULL DEFAULT '',
  sovereignty_charter_status TEXT NOT NULL DEFAULT 'Not Started',  -- Not Started / In Progress / Complete
  sovereignty_charter_detail TEXT NOT NULL DEFAULT '',
  tax_status TEXT NOT NULL DEFAULT 'Not Assessed',                 -- Not Assessed / In Progress / Assessed
  tax_detail TEXT NOT NULL DEFAULT '',

  -- Footer
  footer_note TEXT NOT NULL DEFAULT 'This Stabilization Session is Step One of your Sovereignty Operating System. The full SOS engagement is your next step — and if accepted within 30 days, your Stabilization Session fee will be credited toward the engagement.',

  -- Metadata
  generation_status TEXT NOT NULL DEFAULT 'pending',  -- pending / generating / ready / failed / manually_edited
  generation_error TEXT NULL,
  logic_trace TEXT NULL,   -- AI reasoning log for audit
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_stabilization_maps_lead ON public.stabilization_maps(lead_id);
CREATE INDEX idx_stabilization_maps_contact ON public.stabilization_maps(contact_id);

ALTER TABLE public.stabilization_maps ENABLE ROW LEVEL SECURITY;

-- Staff (authenticated) can read/write all maps
CREATE POLICY "Staff can view stabilization maps"
  ON public.stabilization_maps
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert stabilization maps"
  ON public.stabilization_maps
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can update stabilization maps"
  ON public.stabilization_maps
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Staff can delete stabilization maps"
  ON public.stabilization_maps
  FOR DELETE
  TO authenticated
  USING (true);

-- Service role can insert/update (used by edge function that auto-drafts on lead capture)
CREATE POLICY "Service can insert stabilization maps"
  ON public.stabilization_maps
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can update stabilization maps"
  ON public.stabilization_maps
  FOR UPDATE
  TO service_role
  USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_stabilization_maps_updated_at
  BEFORE UPDATE ON public.stabilization_maps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
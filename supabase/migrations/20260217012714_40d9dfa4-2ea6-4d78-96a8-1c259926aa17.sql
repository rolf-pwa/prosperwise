
-- Discovery leads table for Georgia Discovery Assistant
-- Write-only: public widget can INSERT but never SELECT/UPDATE/DELETE
CREATE TABLE public.discovery_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  transition_type TEXT, -- e.g. 'business_sale', 'divorce', 'legacy_event'
  anxiety_anchor TEXT, -- primary friction point
  vision_summary TEXT, -- 3-year sovereignty vision
  discovery_notes TEXT, -- full conversation summary
  vineyard_summary TEXT, -- vineyard audit findings
  sovereignty_status TEXT NOT NULL DEFAULT 'stabilization_triage_requested',
  pipeda_consent BOOLEAN NOT NULL DEFAULT false,
  pipeda_consented_at TIMESTAMPTZ,
  family_id UUID REFERENCES public.families(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discovery_leads ENABLE ROW LEVEL SECURITY;

-- Anon users can INSERT only (write-only from public widget)
CREATE POLICY "Anon can create discovery leads"
ON public.discovery_leads
FOR INSERT
TO anon
WITH CHECK (true);

-- Authenticated advisors can read all leads
CREATE POLICY "Advisors can view discovery leads"
ON public.discovery_leads
FOR SELECT
TO authenticated
USING (true);

-- Authenticated advisors can update leads
CREATE POLICY "Advisors can update discovery leads"
ON public.discovery_leads
FOR UPDATE
TO authenticated
USING (true);

-- Timestamp trigger
CREATE TRIGGER update_discovery_leads_updated_at
BEFORE UPDATE ON public.discovery_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Portal tokens for magic link access
CREATE TABLE public.portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;

-- Advisors manage tokens internally
CREATE POLICY "Advisors can view all portal tokens"
  ON public.portal_tokens FOR SELECT USING (true);

CREATE POLICY "Advisors can insert portal tokens"
  ON public.portal_tokens FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Advisors can update portal tokens"
  ON public.portal_tokens FOR UPDATE USING (true);

CREATE POLICY "Advisors can delete portal tokens"
  ON public.portal_tokens FOR DELETE USING (true);

-- Add target_value to storehouses for progress bars
ALTER TABLE public.storehouses
  ADD COLUMN IF NOT EXISTS target_value NUMERIC,
  ADD COLUMN IF NOT EXISTS current_value NUMERIC;

-- Create index on token for fast lookups
CREATE INDEX idx_portal_tokens_token ON public.portal_tokens (token);

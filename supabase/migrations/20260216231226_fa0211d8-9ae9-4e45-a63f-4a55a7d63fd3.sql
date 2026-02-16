
-- OTP codes for portal access
CREATE TABLE public.portal_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX idx_portal_otps_email_code ON public.portal_otps (email, code);

-- Auto-cleanup old OTPs (keep 24h for audit)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.portal_otps
  WHERE created_at < now() - interval '24 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_otps
AFTER INSERT ON public.portal_otps
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_otps();

-- RLS: only service role can access (edge function uses service role)
ALTER TABLE public.portal_otps ENABLE ROW LEVEL SECURITY;

-- No public policies - only service_role can read/write

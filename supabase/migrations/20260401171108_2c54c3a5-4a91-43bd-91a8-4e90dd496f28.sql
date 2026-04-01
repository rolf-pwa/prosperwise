CREATE TABLE public.portal_logins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  login_method TEXT NOT NULL DEFAULT 'otp',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_logins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can insert portal logins" ON public.portal_logins
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Staff can view portal logins" ON public.portal_logins
  FOR SELECT TO authenticated USING (true);
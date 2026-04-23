CREATE TABLE public.georgia_session_starts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'discovery',
  landing_path TEXT,
  referrer TEXT,
  user_agent TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.georgia_session_starts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can create Georgia session starts"
ON public.georgia_session_starts
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Staff can view Georgia session starts"
ON public.georgia_session_starts
FOR SELECT
TO authenticated
USING (true);
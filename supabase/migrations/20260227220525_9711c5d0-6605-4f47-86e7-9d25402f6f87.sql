
CREATE TABLE public.marketing_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  target_governance_status TEXT NOT NULL DEFAULT 'all',
  published_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view marketing updates" ON public.marketing_updates FOR SELECT USING (true);
CREATE POLICY "Advisors can insert marketing updates" ON public.marketing_updates FOR INSERT WITH CHECK (auth.uid() = published_by);
CREATE POLICY "Advisors can delete marketing updates" ON public.marketing_updates FOR DELETE USING (true);

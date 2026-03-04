
-- Storage bucket for cashflow CSVs
INSERT INTO storage.buckets (id, name, public) VALUES ('cashflow-uploads', 'cashflow-uploads', false);

-- RLS for cashflow-uploads bucket
CREATE POLICY "Authenticated users can upload cashflow files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cashflow-uploads');

CREATE POLICY "Authenticated users can read cashflow files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cashflow-uploads');

CREATE POLICY "Authenticated users can delete cashflow files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cashflow-uploads');

-- Cashflow analyses table
CREATE TABLE public.cashflow_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  period_start DATE,
  period_end DATE,
  burn_rate JSONB DEFAULT '{}'::jsonb,
  liquidity_status JSONB DEFAULT '{}'::jsonb,
  category_breakdown JSONB DEFAULT '{}'::jsonb,
  outliers JSONB DEFAULT '[]'::jsonb,
  proposed_tasks JSONB DEFAULT '[]'::jsonb,
  logic_trace TEXT,
  raw_report TEXT,
  file_paths TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cashflow_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view cashflow analyses"
ON public.cashflow_analyses FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Advisors can insert cashflow analyses"
ON public.cashflow_analyses FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Advisors can update cashflow analyses"
ON public.cashflow_analyses FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Advisors can delete cashflow analyses"
ON public.cashflow_analyses FOR DELETE TO authenticated
USING (true);

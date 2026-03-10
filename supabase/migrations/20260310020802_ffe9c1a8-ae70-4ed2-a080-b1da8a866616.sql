
-- Create pipeline category enum
CREATE TYPE public.pipeline_category AS ENUM ('pws_consulting', 'new_aum', 'insurance');

-- Create pipeline status enum
CREATE TYPE public.pipeline_status AS ENUM ('pending', 'in_process', 'completed');

-- Create business pipeline table
CREATE TABLE public.business_pipeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  category pipeline_category NOT NULL,
  status pipeline_status NOT NULL DEFAULT 'pending',
  amount NUMERIC NOT NULL DEFAULT 0,
  expected_close_date DATE,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_pipeline ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Advisors can view pipeline" ON public.business_pipeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Advisors can insert pipeline" ON public.business_pipeline FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Advisors can update pipeline" ON public.business_pipeline FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Advisors can delete pipeline" ON public.business_pipeline FOR DELETE TO authenticated USING (true);

-- Updated at trigger
CREATE TRIGGER update_business_pipeline_updated_at BEFORE UPDATE ON public.business_pipeline FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

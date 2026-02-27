
-- Corporate-to-corporate ownership (e.g. HoldCo owns % of OpCo)
CREATE TABLE public.corporate_shareholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_corporation_id UUID NOT NULL REFERENCES public.corporations(id) ON DELETE CASCADE,
  child_corporation_id UUID NOT NULL REFERENCES public.corporations(id) ON DELETE CASCADE,
  ownership_percentage NUMERIC NOT NULL DEFAULT 0 CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
  share_class TEXT DEFAULT 'Common',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (parent_corporation_id, child_corporation_id),
  CHECK (parent_corporation_id != child_corporation_id)
);

ALTER TABLE public.corporate_shareholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view corporate shareholders" ON public.corporate_shareholders FOR SELECT USING (true);
CREATE POLICY "Advisors can insert corporate shareholders" ON public.corporate_shareholders FOR INSERT WITH CHECK (true);
CREATE POLICY "Advisors can update corporate shareholders" ON public.corporate_shareholders FOR UPDATE USING (true);
CREATE POLICY "Advisors can delete corporate shareholders" ON public.corporate_shareholders FOR DELETE USING (true);

CREATE TRIGGER update_corporate_shareholders_updated_at BEFORE UPDATE ON public.corporate_shareholders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

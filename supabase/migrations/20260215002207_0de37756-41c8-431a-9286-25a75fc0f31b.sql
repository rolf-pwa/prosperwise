
CREATE TABLE public.family_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  member_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  relationship_label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.family_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view all family relationships" ON public.family_relationships FOR SELECT USING (true);
CREATE POLICY "Advisors can insert family relationships" ON public.family_relationships FOR INSERT WITH CHECK (true);
CREATE POLICY "Advisors can update family relationships" ON public.family_relationships FOR UPDATE USING (true);
CREATE POLICY "Advisors can delete family relationships" ON public.family_relationships FOR DELETE USING (true);

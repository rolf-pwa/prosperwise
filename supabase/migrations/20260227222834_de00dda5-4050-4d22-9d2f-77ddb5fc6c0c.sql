
CREATE TABLE public.marketing_update_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  update_id UUID NOT NULL REFERENCES public.marketing_updates(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, update_id)
);

ALTER TABLE public.marketing_update_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read marketing_update_reads" ON public.marketing_update_reads FOR SELECT USING (true);
CREATE POLICY "Anyone can insert marketing_update_reads" ON public.marketing_update_reads FOR INSERT WITH CHECK (true);


-- Junction table for household relationships between contacts
CREATE TABLE public.household_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  member_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  relationship_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contact_id, member_contact_id),
  CHECK (contact_id != member_contact_id)
);

ALTER TABLE public.household_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view all household relationships"
  ON public.household_relationships FOR SELECT USING (true);

CREATE POLICY "Advisors can insert household relationships"
  ON public.household_relationships FOR INSERT WITH CHECK (true);

CREATE POLICY "Advisors can update household relationships"
  ON public.household_relationships FOR UPDATE USING (true);

CREATE POLICY "Advisors can delete household relationships"
  ON public.household_relationships FOR DELETE USING (true);

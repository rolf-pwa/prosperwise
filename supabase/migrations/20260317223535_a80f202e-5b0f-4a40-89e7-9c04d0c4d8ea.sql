CREATE TABLE public.portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text NOT NULL,
  icon text NOT NULL DEFAULT 'ExternalLink',
  group_label text DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  link_type text NOT NULL DEFAULT 'external',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view portal links" ON public.portal_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Advisors can insert portal links" ON public.portal_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Advisors can update portal links" ON public.portal_links FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Advisors can delete portal links" ON public.portal_links FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon can read active portal links" ON public.portal_links FOR SELECT TO anon USING (is_active = true);

CREATE TRIGGER update_portal_links_updated_at BEFORE UPDATE ON public.portal_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
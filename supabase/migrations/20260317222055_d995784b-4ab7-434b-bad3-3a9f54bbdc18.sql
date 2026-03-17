
-- Knowledge base table for Georgia's baked-in knowledge
CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  source_type text NOT NULL DEFAULT 'text',
  file_path text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view knowledge base"
  ON public.knowledge_base FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Advisors can insert knowledge base"
  ON public.knowledge_base FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Advisors can update knowledge base"
  ON public.knowledge_base FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Advisors can delete knowledge base"
  ON public.knowledge_base FOR DELETE TO authenticated
  USING (true);

-- Allow the edge function (anon/service) to read knowledge base
CREATE POLICY "Anon can read active knowledge"
  ON public.knowledge_base FOR SELECT TO anon
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON public.knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for knowledge base file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-base', 'knowledge-base', false);

-- RLS for knowledge-base storage
CREATE POLICY "Advisors can upload knowledge files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge-base');

CREATE POLICY "Advisors can view knowledge files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-base');

CREATE POLICY "Advisors can delete knowledge files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-base');

CREATE POLICY "Anon can read knowledge files"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'knowledge-base');

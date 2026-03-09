
CREATE TABLE public.portal_task_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  task_gid TEXT NOT NULL,
  interacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, task_gid)
);

ALTER TABLE public.portal_task_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert for portal interactions"
  ON public.portal_task_interactions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon select for portal interactions"
  ON public.portal_task_interactions
  FOR SELECT
  TO anon
  USING (true);

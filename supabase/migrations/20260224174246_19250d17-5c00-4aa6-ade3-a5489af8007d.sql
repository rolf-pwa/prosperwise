
CREATE TABLE public.task_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_gid TEXT NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tagged_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one contact can only be tagged once per task
ALTER TABLE public.task_collaborators ADD CONSTRAINT task_collaborators_unique UNIQUE (task_gid, contact_id);

-- Index for fast lookups by contact
CREATE INDEX idx_task_collaborators_contact ON public.task_collaborators(contact_id);

-- RLS
ALTER TABLE public.task_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view task collaborators"
  ON public.task_collaborators FOR SELECT USING (true);

CREATE POLICY "Advisors can insert task collaborators"
  ON public.task_collaborators FOR INSERT WITH CHECK (true);

CREATE POLICY "Advisors can delete task collaborators"
  ON public.task_collaborators FOR DELETE USING (true);

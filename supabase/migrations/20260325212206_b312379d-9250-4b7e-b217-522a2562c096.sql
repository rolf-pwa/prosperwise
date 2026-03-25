
CREATE TABLE public.portal_client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  source_type text NOT NULL DEFAULT 'task',
  link_tab text DEFAULT 'tasks',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_client_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read own notifications" ON public.portal_client_notifications
  FOR SELECT TO anon USING (true);

CREATE POLICY "Service can insert notifications" ON public.portal_client_notifications
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anon can update notifications" ON public.portal_client_notifications
  FOR UPDATE TO anon USING (true);

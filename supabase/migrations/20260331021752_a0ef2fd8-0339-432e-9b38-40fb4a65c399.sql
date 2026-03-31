
CREATE TABLE public.drive_watch_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  last_checked_at timestamp with time zone NOT NULL DEFAULT now(),
  last_file_found_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contact_id)
);

ALTER TABLE public.drive_watch_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can insert drive watch state"
  ON public.drive_watch_state FOR INSERT
  TO public WITH CHECK (true);

CREATE POLICY "Service can update drive watch state"
  ON public.drive_watch_state FOR UPDATE
  TO public USING (true);

CREATE POLICY "Staff can view drive watch state"
  ON public.drive_watch_state FOR SELECT
  TO authenticated USING (true);

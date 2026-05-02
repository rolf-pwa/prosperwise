
CREATE TABLE public.quo_inbox_archive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_key TEXT NOT NULL UNIQUE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  phone_digits TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_quo_inbox_archive_contact ON public.quo_inbox_archive(contact_id);
CREATE INDEX idx_quo_inbox_archive_phone ON public.quo_inbox_archive(phone_digits);

ALTER TABLE public.quo_inbox_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view archive"
  ON public.quo_inbox_archive FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can archive threads"
  ON public.quo_inbox_archive FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can update archive"
  ON public.quo_inbox_archive FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Staff can unarchive threads"
  ON public.quo_inbox_archive FOR DELETE
  TO authenticated
  USING (true);

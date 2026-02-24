
-- Create staff_notifications table
CREATE TABLE public.staff_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'request',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

-- All authenticated staff can view notifications
CREATE POLICY "Staff can view notifications" ON public.staff_notifications FOR SELECT TO authenticated USING (true);

-- Staff can update (mark read)
CREATE POLICY "Staff can update notifications" ON public.staff_notifications FOR UPDATE TO authenticated USING (true);

-- Service role inserts via edge functions
CREATE POLICY "Service can insert notifications" ON public.staff_notifications FOR INSERT WITH CHECK (true);

-- Staff can delete notifications
CREATE POLICY "Staff can delete notifications" ON public.staff_notifications FOR DELETE TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_notifications;

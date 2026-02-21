
-- Create a table for conversation messages on portal requests
CREATE TABLE public.portal_request_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.portal_requests(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('advisor', 'client')),
  sender_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_request_messages ENABLE ROW LEVEL SECURITY;

-- Advisors (authenticated) can do everything
CREATE POLICY "Advisors can view all request messages"
  ON public.portal_request_messages FOR SELECT USING (true);

CREATE POLICY "Advisors can insert request messages"
  ON public.portal_request_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Advisors can delete request messages"
  ON public.portal_request_messages FOR DELETE USING (true);

-- Index for fast lookups
CREATE INDEX idx_portal_request_messages_request_id ON public.portal_request_messages(request_id);

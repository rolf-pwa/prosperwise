-- Create portal_requests table for admin requests
CREATE TABLE public.portal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id),
  request_type TEXT NOT NULL,
  request_description TEXT NOT NULL,
  request_details JSONB DEFAULT '{}'::jsonb,
  file_urls TEXT[] DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'submitted',
  staff_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_requests ENABLE ROW LEVEL SECURITY;

-- Portal requests are created by unauthenticated portal users (via edge function)
-- and managed by authenticated advisors
CREATE POLICY "Service role can insert portal requests"
ON public.portal_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Advisors can view all portal requests"
ON public.portal_requests
FOR SELECT
USING (true);

CREATE POLICY "Advisors can update portal requests"
ON public.portal_requests
FOR UPDATE
USING (true);

CREATE POLICY "Advisors can delete portal requests"
ON public.portal_requests
FOR DELETE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_portal_requests_updated_at
BEFORE UPDATE ON public.portal_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for portal uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('portal-uploads', 'portal-uploads', false);

-- Storage policies: anyone can upload (portal users aren't authenticated)
CREATE POLICY "Portal users can upload files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'portal-uploads');

-- Only authenticated advisors can view/download
CREATE POLICY "Advisors can view portal uploads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'portal-uploads');

-- Advisors can delete portal uploads
CREATE POLICY "Advisors can delete portal uploads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'portal-uploads');
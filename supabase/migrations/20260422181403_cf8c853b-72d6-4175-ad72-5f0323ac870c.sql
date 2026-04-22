ALTER TABLE public.sovereignty_charters
ADD COLUMN IF NOT EXISTS draft_status TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS ratified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ratified_by UUID,
ADD COLUMN IF NOT EXISTS generation_summary TEXT,
ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.sovereignty_charter_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charter_id UUID REFERENCES public.sovereignty_charters(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,
  input_mode TEXT NOT NULL DEFAULT 'text',
  title TEXT NOT NULL DEFAULT 'Untitled source',
  source_url TEXT,
  content_text TEXT,
  extracted_text TEXT,
  storage_bucket TEXT,
  storage_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT sovereignty_charter_sources_kind_check CHECK (source_kind IN ('statement', 'stabilization_session', 'meeting_transcript', 'link', 'note')),
  CONSTRAINT sovereignty_charter_sources_input_mode_check CHECK (input_mode IN ('upload', 'text', 'url'))
);

ALTER TABLE public.sovereignty_charter_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ProsperWise staff can view charter sources"
ON public.sovereignty_charter_sources
FOR SELECT
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@prosperwise.ca');

CREATE POLICY "ProsperWise staff can create charter sources"
ON public.sovereignty_charter_sources
FOR INSERT
TO authenticated
WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@prosperwise.ca');

CREATE POLICY "ProsperWise staff can edit charter sources"
ON public.sovereignty_charter_sources
FOR UPDATE
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@prosperwise.ca')
WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@prosperwise.ca');

CREATE POLICY "ProsperWise staff can remove charter sources"
ON public.sovereignty_charter_sources
FOR DELETE
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@prosperwise.ca');

CREATE TRIGGER update_sovereignty_charter_sources_updated_at
BEFORE UPDATE ON public.sovereignty_charter_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('charter-source-uploads', 'charter-source-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ProsperWise staff can view charter source files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'charter-source-uploads'
  AND lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@prosperwise.ca'
);

CREATE POLICY "ProsperWise staff can upload charter source files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'charter-source-uploads'
  AND lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@prosperwise.ca'
);

CREATE POLICY "ProsperWise staff can update charter source files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'charter-source-uploads'
  AND lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@prosperwise.ca'
)
WITH CHECK (
  bucket_id = 'charter-source-uploads'
  AND lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@prosperwise.ca'
);

CREATE POLICY "ProsperWise staff can delete charter source files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'charter-source-uploads'
  AND lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@prosperwise.ca'
);
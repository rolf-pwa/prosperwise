
-- Drop existing overly permissive storage policies on portal-uploads
DROP POLICY IF EXISTS "Advisors can view portal uploads" ON storage.objects;
DROP POLICY IF EXISTS "Advisors can delete portal uploads" ON storage.objects;
DROP POLICY IF EXISTS "Portal users can upload files" ON storage.objects;

-- Authenticated staff can view portal uploads
CREATE POLICY "Staff can view portal uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'portal-uploads');

-- Authenticated staff can delete portal uploads
CREATE POLICY "Staff can delete portal uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'portal-uploads');

-- Authenticated staff can upload to portal-uploads
CREATE POLICY "Staff can upload portal files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'portal-uploads');

-- Service role INSERT for edge function proxy (service_role bypasses RLS, but explicit for clarity)
CREATE POLICY "Service can upload portal files"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'portal-uploads');

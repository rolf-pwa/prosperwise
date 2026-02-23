
-- Create storage bucket for statement uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('statement-uploads', 'statement-uploads', false);

-- Authenticated users can upload statements
CREATE POLICY "Authenticated users can upload statements"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'statement-uploads' AND auth.role() = 'authenticated');

-- Authenticated users can read statements
CREATE POLICY "Authenticated users can read statements"
ON storage.objects FOR SELECT
USING (bucket_id = 'statement-uploads' AND auth.role() = 'authenticated');

-- Authenticated users can delete statements
CREATE POLICY "Authenticated users can delete statements"
ON storage.objects FOR DELETE
USING (bucket_id = 'statement-uploads' AND auth.role() = 'authenticated');

-- Remove anonymous read policy on knowledge_base table
DROP POLICY IF EXISTS "Anon can read active knowledge" ON public.knowledge_base;

-- Remove anonymous read policy on knowledge-base storage bucket (if exists)
DROP POLICY IF EXISTS "Anon can read knowledge base files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read knowledge base files" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous can read knowledge-base bucket" ON storage.objects;
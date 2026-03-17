ALTER TABLE public.knowledge_base ADD COLUMN target text NOT NULL DEFAULT 'both';
COMMENT ON COLUMN public.knowledge_base.target IS 'Which Georgia bot uses this entry: transition, portal, or both';
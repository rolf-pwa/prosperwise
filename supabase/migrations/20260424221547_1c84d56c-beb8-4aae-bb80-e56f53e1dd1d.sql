ALTER TABLE public.sovereignty_charter_sources DROP CONSTRAINT IF EXISTS sovereignty_charter_sources_kind_check;

ALTER TABLE public.sovereignty_charter_sources ADD CONSTRAINT sovereignty_charter_sources_kind_check
  CHECK (source_kind = ANY (ARRAY['statement'::text, 'stabilization_session'::text, 'meeting_transcript'::text, 'link'::text, 'note'::text, 'quarterly_review'::text]));
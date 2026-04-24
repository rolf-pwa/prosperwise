ALTER TABLE public.quarterly_system_reviews
  ADD COLUMN IF NOT EXISTS purpose_statement text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS primary_goal text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS long_term_vision text NOT NULL DEFAULT '';
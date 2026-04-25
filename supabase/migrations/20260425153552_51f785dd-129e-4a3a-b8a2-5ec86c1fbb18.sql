ALTER TABLE public.georgia_session_starts
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reached_lead_capture BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_captured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_phase TEXT NOT NULL DEFAULT 'chat';

CREATE INDEX IF NOT EXISTS idx_georgia_session_starts_session_key
  ON public.georgia_session_starts (session_key);

CREATE INDEX IF NOT EXISTS idx_georgia_session_starts_last_activity
  ON public.georgia_session_starts (last_activity_at DESC);

-- Drop & recreate UPDATE deny by allowing service role only (anon updates go through edge function with service role).
-- Existing policy set already prevents anon/authenticated updates; keep that.
-- Add a service_role policy so the edge function can update via service key.
DROP POLICY IF EXISTS "Service role can update Georgia session starts" ON public.georgia_session_starts;
CREATE POLICY "Service role can update Georgia session starts"
  ON public.georgia_session_starts
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
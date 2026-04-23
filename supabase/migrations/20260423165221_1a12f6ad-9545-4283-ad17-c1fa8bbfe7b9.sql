DROP POLICY IF EXISTS "Anon can create Georgia session starts" ON public.georgia_session_starts;

CREATE POLICY "Anon can create Georgia session starts"
ON public.georgia_session_starts
FOR INSERT
TO anon
WITH CHECK (
  source IN ('discovery', 'discovery_embed')
  AND char_length(session_key) BETWEEN 12 AND 128
  AND (landing_path IS NULL OR char_length(landing_path) <= 255)
  AND (referrer IS NULL OR char_length(referrer) <= 1000)
  AND (user_agent IS NULL OR char_length(user_agent) <= 1000)
);
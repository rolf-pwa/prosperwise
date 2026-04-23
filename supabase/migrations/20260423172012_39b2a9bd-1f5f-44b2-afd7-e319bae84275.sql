create policy "Authenticated users can create Georgia session starts"
on public.georgia_session_starts
for insert
to authenticated
with check (
  (source = any (array['discovery'::text, 'discovery_embed'::text]))
  and char_length(session_key) >= 12
  and char_length(session_key) <= 128
  and (landing_path is null or char_length(landing_path) <= 255)
  and (referrer is null or char_length(referrer) <= 1000)
  and (user_agent is null or char_length(user_agent) <= 1000)
);
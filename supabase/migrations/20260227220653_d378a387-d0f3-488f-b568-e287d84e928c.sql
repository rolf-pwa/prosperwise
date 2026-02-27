
-- Allow anon/public read so portal clients can fetch updates
CREATE POLICY "Anyone can view marketing updates" ON public.marketing_updates FOR SELECT USING (true);

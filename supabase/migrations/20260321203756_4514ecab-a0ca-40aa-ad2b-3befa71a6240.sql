CREATE POLICY "Allow update marketing_updates"
  ON public.marketing_updates
  FOR UPDATE
  TO public
  USING (true);
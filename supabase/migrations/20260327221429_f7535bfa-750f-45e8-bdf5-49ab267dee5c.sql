
CREATE TABLE public.daily_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recap_date date NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text DEFAULT '',
  ai_draft text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recap_date, author_id)
);

ALTER TABLE public.daily_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all recaps"
  ON public.daily_recaps FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authors can insert own recaps"
  ON public.daily_recaps FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own recaps"
  ON public.daily_recaps FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE TRIGGER update_daily_recaps_updated_at
  BEFORE UPDATE ON public.daily_recaps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

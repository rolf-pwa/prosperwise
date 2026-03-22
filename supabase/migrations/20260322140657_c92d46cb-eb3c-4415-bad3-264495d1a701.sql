
-- Create the Holding Tank table for pre-ratification accounts
CREATE TABLE public.holding_tank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  account_name TEXT NOT NULL,
  account_number TEXT,
  account_type TEXT NOT NULL DEFAULT 'Portfolio',
  account_owner TEXT,
  custodian TEXT,
  book_value NUMERIC,
  current_value NUMERIC,
  notes TEXT,
  source_file TEXT,
  status TEXT NOT NULL DEFAULT 'holding',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add book_value to vineyard_accounts for BOY tracking
ALTER TABLE public.vineyard_accounts ADD COLUMN IF NOT EXISTS book_value NUMERIC;

-- Add book_value to storehouses for BOY tracking
ALTER TABLE public.storehouses ADD COLUMN IF NOT EXISTS book_value NUMERIC;

-- Enable RLS on holding_tank
ALTER TABLE public.holding_tank ENABLE ROW LEVEL SECURITY;

-- RLS policies for holding_tank (authenticated advisors only)
CREATE POLICY "Advisors can view holding tank" ON public.holding_tank
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Advisors can insert holding tank" ON public.holding_tank
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Advisors can update holding tank" ON public.holding_tank
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Advisors can delete holding tank" ON public.holding_tank
  FOR DELETE TO authenticated USING (true);

-- Updated_at trigger
CREATE TRIGGER update_holding_tank_updated_at
  BEFORE UPDATE ON public.holding_tank
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

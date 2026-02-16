
CREATE TABLE public.vineyard_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'Portfolio',
  current_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vineyard_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view all vineyard accounts"
ON public.vineyard_accounts FOR SELECT USING (true);

CREATE POLICY "Advisors can insert vineyard accounts"
ON public.vineyard_accounts FOR INSERT WITH CHECK (true);

CREATE POLICY "Advisors can update vineyard accounts"
ON public.vineyard_accounts FOR UPDATE USING (true);

CREATE POLICY "Advisors can delete vineyard accounts"
ON public.vineyard_accounts FOR DELETE USING (true);

CREATE TRIGGER update_vineyard_accounts_updated_at
BEFORE UPDATE ON public.vineyard_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.account_harvest_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  vineyard_account_id UUID REFERENCES public.vineyard_accounts(id) ON DELETE CASCADE,
  storehouse_id UUID REFERENCES public.storehouses(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reporting_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  boy_value NUMERIC NOT NULL DEFAULT 0,
  ytd_value NUMERIC NOT NULL DEFAULT 0,
  current_harvest NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_account_harvest_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  vineyard_contact_id UUID;
  storehouse_contact_id UUID;
BEGIN
  IF ((NEW.vineyard_account_id IS NOT NULL)::INT + (NEW.storehouse_id IS NOT NULL)::INT) <> 1 THEN
    RAISE EXCEPTION 'Each harvest snapshot must reference exactly one account source';
  END IF;

  IF NEW.vineyard_account_id IS NOT NULL THEN
    SELECT contact_id INTO vineyard_contact_id
    FROM public.vineyard_accounts
    WHERE id = NEW.vineyard_account_id;

    IF vineyard_contact_id IS NULL THEN
      RAISE EXCEPTION 'Referenced Vineyard account was not found';
    END IF;

    IF NEW.contact_id <> vineyard_contact_id THEN
      RAISE EXCEPTION 'Snapshot contact does not match the Vineyard account owner';
    END IF;
  END IF;

  IF NEW.storehouse_id IS NOT NULL THEN
    SELECT contact_id INTO storehouse_contact_id
    FROM public.storehouses
    WHERE id = NEW.storehouse_id;

    IF storehouse_contact_id IS NULL THEN
      RAISE EXCEPTION 'Referenced Storehouse account was not found';
    END IF;

    IF NEW.contact_id <> storehouse_contact_id THEN
      RAISE EXCEPTION 'Snapshot contact does not match the Storehouse owner';
    END IF;
  END IF;

  NEW.reporting_year := EXTRACT(YEAR FROM NEW.snapshot_date)::INTEGER;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_account_harvest_snapshot_before_write
BEFORE INSERT OR UPDATE ON public.account_harvest_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.validate_account_harvest_snapshot();

CREATE TRIGGER update_account_harvest_snapshots_updated_at
BEFORE UPDATE ON public.account_harvest_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX account_harvest_snapshots_vineyard_date_idx
  ON public.account_harvest_snapshots (vineyard_account_id, snapshot_date)
  WHERE vineyard_account_id IS NOT NULL;

CREATE UNIQUE INDEX account_harvest_snapshots_storehouse_date_idx
  ON public.account_harvest_snapshots (storehouse_id, snapshot_date)
  WHERE storehouse_id IS NOT NULL;

CREATE INDEX account_harvest_snapshots_contact_year_idx
  ON public.account_harvest_snapshots (contact_id, reporting_year, snapshot_date DESC);

ALTER TABLE public.account_harvest_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view harvest snapshots"
ON public.account_harvest_snapshots
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can insert harvest snapshots"
ON public.account_harvest_snapshots
FOR INSERT
TO authenticated
WITH CHECK ((created_by IS NULL) OR (auth.uid() = created_by));

CREATE POLICY "Staff can update harvest snapshots"
ON public.account_harvest_snapshots
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK ((created_by IS NULL) OR (auth.uid() = created_by));

CREATE POLICY "Staff can delete harvest snapshots"
ON public.account_harvest_snapshots
FOR DELETE
TO authenticated
USING (true);

-- Drop any existing INSERT policy on portal_otps that allows public access
DROP POLICY IF EXISTS "Allow public insert" ON public.portal_otps;
DROP POLICY IF EXISTS "Anyone can insert OTPs" ON public.portal_otps;
DROP POLICY IF EXISTS "Public can insert OTPs" ON public.portal_otps;

-- Restrict INSERT to service_role only
CREATE POLICY "Service role can insert OTPs"
ON public.portal_otps
FOR INSERT
TO service_role
WITH CHECK (true);

-- Explicitly deny SELECT for anon and authenticated
CREATE POLICY "Deny public select on OTPs"
ON public.portal_otps
FOR SELECT
TO anon, authenticated
USING (false);

-- Deny UPDATE for anon and authenticated
CREATE POLICY "Deny public update on OTPs"
ON public.portal_otps
FOR UPDATE
TO anon, authenticated
USING (false);

-- Deny DELETE for anon and authenticated
CREATE POLICY "Deny public delete on OTPs"
ON public.portal_otps
FOR DELETE
TO anon, authenticated
USING (false);

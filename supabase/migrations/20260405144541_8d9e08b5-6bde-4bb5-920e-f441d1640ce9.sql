
-- Fix vineyard_accounts: restrict all policies from {public} to {authenticated}
DROP POLICY IF EXISTS "Advisors can view vineyard accounts" ON vineyard_accounts;
DROP POLICY IF EXISTS "Advisors can insert vineyard accounts" ON vineyard_accounts;
DROP POLICY IF EXISTS "Advisors can update vineyard accounts" ON vineyard_accounts;
DROP POLICY IF EXISTS "Advisors can delete vineyard accounts" ON vineyard_accounts;

CREATE POLICY "Staff can view vineyard accounts" ON vineyard_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert vineyard accounts" ON vineyard_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update vineyard accounts" ON vineyard_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete vineyard accounts" ON vineyard_accounts FOR DELETE TO authenticated USING (true);

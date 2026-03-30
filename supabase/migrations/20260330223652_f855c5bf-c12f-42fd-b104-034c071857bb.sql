
CREATE TABLE public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  test_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS', 'FAIL', 'ERROR')),
  logic_trace text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view audit logs"
  ON public.security_audit_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service can insert audit logs"
  ON public.security_audit_logs FOR INSERT
  TO public WITH CHECK (true);

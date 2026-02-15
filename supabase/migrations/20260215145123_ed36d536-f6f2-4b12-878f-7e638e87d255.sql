
-- Sovereignty Audit Trail: logs every AI-proposed action approved by the Personal CFO
CREATE TABLE public.sovereignty_audit_trail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  proposed_data JSONB,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sovereignty_audit_trail ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view audit trail
CREATE POLICY "Users can view audit trail" ON public.sovereignty_audit_trail
  FOR SELECT USING (auth.uid() = user_id);

-- Only authenticated users can insert audit entries
CREATE POLICY "Users can create audit entries" ON public.sovereignty_audit_trail
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups by contact
CREATE INDEX idx_audit_trail_contact ON public.sovereignty_audit_trail(contact_id);
CREATE INDEX idx_audit_trail_user ON public.sovereignty_audit_trail(user_id);

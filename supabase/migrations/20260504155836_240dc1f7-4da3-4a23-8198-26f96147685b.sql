
-- 1. Add vault root to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS vault_root_folder_id text;

-- 2. Folder templates
CREATE TABLE IF NOT EXISTS public.vault_folder_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position int NOT NULL DEFAULT 0,
  display_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vault_folder_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage templates" ON public.vault_folder_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.vault_folder_templates (position, display_name, slug) VALUES
  (1, '01 Identity & Legal', 'identity-legal'),
  (2, '02 Estate (Wills, POA, Trusts)', 'estate'),
  (3, '03 Tax', 'tax'),
  (4, '04 Insurance', 'insurance'),
  (5, '05 Investment Statements', 'investments'),
  (6, '06 Real Estate & Mortgages', 'real-estate'),
  (7, '07 Business Entities', 'business'),
  (8, '08 Sovereignty Charter Sources', 'charter-sources'),
  (9, '09 Quarterly Reviews', 'quarterly-reviews'),
  (10, '10 Correspondence (Signed Docs)', 'correspondence'),
  (11, '99 From Collaborators', 'from-collaborators')
ON CONFLICT (slug) DO NOTHING;

-- 3. File cache (with ancestor chain for firewall)
CREATE TABLE IF NOT EXISTS public.vault_files (
  drive_id text PRIMARY KEY,
  contact_id uuid NOT NULL,
  parent_folder_id text,
  ancestor_folder_ids text[] NOT NULL DEFAULT '{}',
  name text NOT NULL,
  mime_type text NOT NULL,
  is_folder boolean NOT NULL DEFAULT false,
  size_bytes bigint,
  modified_at timestamptz,
  client_visible boolean NOT NULL DEFAULT false,
  uploaded_by_collaborator_id uuid,
  staff_reviewed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vault_files_contact ON public.vault_files(contact_id);
CREATE INDEX IF NOT EXISTS idx_vault_files_parent ON public.vault_files(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_vault_files_ancestors ON public.vault_files USING GIN (ancestor_folder_ids);
ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage vault files" ON public.vault_files
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service manage vault files" ON public.vault_files
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Collaborators
CREATE TABLE IF NOT EXISTS public.vault_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'other', -- lawyer | accountant | executor | poa | other
  professional_contact_id uuid,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, email)
);
CREATE INDEX IF NOT EXISTS idx_vault_collab_contact ON public.vault_collaborators(contact_id);
ALTER TABLE public.vault_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage collaborators" ON public.vault_collaborators
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service read collaborators" ON public.vault_collaborators
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Grants
CREATE TABLE IF NOT EXISTS public.vault_collaborator_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.vault_collaborators(id) ON DELETE CASCADE,
  scope_type text NOT NULL, -- 'folder' | 'file'
  drive_id text NOT NULL,
  permission text NOT NULL DEFAULT 'view', -- 'view' | 'upload'
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vault_grants_collab ON public.vault_collaborator_grants(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_vault_grants_drive ON public.vault_collaborator_grants(drive_id);
ALTER TABLE public.vault_collaborator_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage grants" ON public.vault_collaborator_grants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service read grants" ON public.vault_collaborator_grants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Guest tokens (magic link + OTP code)
CREATE TABLE IF NOT EXISTS public.vault_guest_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.vault_collaborators(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  unlock_code text NOT NULL,
  unlock_verified_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  bound_user_agent text,
  bound_ip text,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vault_guest_tokens_collab ON public.vault_guest_tokens(collaborator_id);
ALTER TABLE public.vault_guest_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manage guest tokens" ON public.vault_guest_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Deny direct access" ON public.vault_guest_tokens
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 7. Audit log
CREATE TABLE IF NOT EXISTS public.vault_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid,
  actor_type text NOT NULL, -- 'staff' | 'client' | 'collaborator'
  actor_id uuid,
  actor_label text,
  action text NOT NULL, -- 'list' | 'preview' | 'download' | 'upload' | 'rename' | 'delete' | 'grant' | 'revoke' | 'firewall_block'
  drive_id text,
  drive_name text,
  ip text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vault_audit_contact ON public.vault_audit_log(contact_id, created_at DESC);
ALTER TABLE public.vault_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view audit" ON public.vault_audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service write audit" ON public.vault_audit_log
  FOR INSERT TO service_role WITH CHECK (true);

-- 8. updated_at triggers
CREATE TRIGGER trg_vault_files_updated BEFORE UPDATE ON public.vault_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vault_collab_updated BEFORE UPDATE ON public.vault_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vault_templates_updated BEFORE UPDATE ON public.vault_folder_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

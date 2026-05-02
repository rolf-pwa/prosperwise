
-- Quo Messages (SMS)
CREATE TABLE public.quo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quo_message_id TEXT UNIQUE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',
  media_urls TEXT[] DEFAULT '{}',
  quo_user_id TEXT,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  portal_visible BOOLEAN NOT NULL DEFAULT FALSE,
  pii_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  pii_block_reason TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quo_messages_contact ON public.quo_messages(contact_id, occurred_at DESC);
CREATE INDEX idx_quo_messages_portal ON public.quo_messages(contact_id, portal_visible) WHERE portal_visible = TRUE;

ALTER TABLE public.quo_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view quo messages" ON public.quo_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert quo messages" ON public.quo_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update quo messages" ON public.quo_messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete quo messages" ON public.quo_messages FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service can insert quo messages" ON public.quo_messages FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can update quo messages" ON public.quo_messages FOR UPDATE TO service_role USING (true);

CREATE TRIGGER update_quo_messages_updated_at BEFORE UPDATE ON public.quo_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quo Calls
CREATE TABLE public.quo_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quo_call_id TEXT UNIQUE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  duration_seconds INTEGER DEFAULT 0,
  recording_url TEXT,
  transcript TEXT,
  summary TEXT,
  next_steps TEXT,
  quo_user_id TEXT,
  portal_visible BOOLEAN NOT NULL DEFAULT FALSE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quo_calls_contact ON public.quo_calls(contact_id, occurred_at DESC);
CREATE INDEX idx_quo_calls_portal ON public.quo_calls(contact_id, portal_visible) WHERE portal_visible = TRUE;

ALTER TABLE public.quo_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view quo calls" ON public.quo_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert quo calls" ON public.quo_calls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update quo calls" ON public.quo_calls FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete quo calls" ON public.quo_calls FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service can insert quo calls" ON public.quo_calls FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can update quo calls" ON public.quo_calls FOR UPDATE TO service_role USING (true);

CREATE TRIGGER update_quo_calls_updated_at BEFORE UPDATE ON public.quo_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quo Contact Sync
CREATE TABLE public.quo_contact_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  quo_contact_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('to_quo', 'from_quo', 'bidirectional')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_id),
  UNIQUE(quo_contact_id)
);

ALTER TABLE public.quo_contact_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view quo contact sync" ON public.quo_contact_sync FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert quo contact sync" ON public.quo_contact_sync FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update quo contact sync" ON public.quo_contact_sync FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete quo contact sync" ON public.quo_contact_sync FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service can manage quo contact sync" ON public.quo_contact_sync FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_quo_contact_sync_updated_at BEFORE UPDATE ON public.quo_contact_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quo Webhook Events (audit log)
CREATE TABLE public.quo_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  quo_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quo_webhook_events_type ON public.quo_webhook_events(event_type, received_at DESC);
CREATE INDEX idx_quo_webhook_events_unprocessed ON public.quo_webhook_events(processed, received_at) WHERE processed = FALSE;

ALTER TABLE public.quo_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view quo webhook events" ON public.quo_webhook_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert quo webhook events" ON public.quo_webhook_events FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can update quo webhook events" ON public.quo_webhook_events FOR UPDATE TO service_role USING (true);

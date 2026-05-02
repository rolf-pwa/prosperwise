ALTER TABLE public.quo_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.quo_calls ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_quo_messages_unread ON public.quo_messages (read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quo_calls_unread ON public.quo_calls (read_at) WHERE read_at IS NULL;
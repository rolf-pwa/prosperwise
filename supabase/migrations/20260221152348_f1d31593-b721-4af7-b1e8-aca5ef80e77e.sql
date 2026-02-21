
-- Review queue status enum
CREATE TYPE public.review_status AS ENUM ('pending', 'approved', 'rejected', 'escalated');

-- HITL Review Queue table
CREATE TABLE public.review_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  proposed_data JSONB DEFAULT '{}'::jsonb,
  logic_trace TEXT,
  status public.review_status NOT NULL DEFAULT 'pending',
  client_visible BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  escalated_to TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;

-- Policies: all authenticated advisors can CRUD
CREATE POLICY "Advisors can view review queue"
  ON public.review_queue FOR SELECT
  USING (true);

CREATE POLICY "Advisors can insert review queue"
  ON public.review_queue FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Advisors can update review queue"
  ON public.review_queue FOR UPDATE
  USING (true);

CREATE POLICY "Advisors can delete review queue"
  ON public.review_queue FOR DELETE
  USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_review_queue_updated_at
  BEFORE UPDATE ON public.review_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

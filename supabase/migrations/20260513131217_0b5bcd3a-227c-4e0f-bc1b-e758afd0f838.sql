-- Centralised admin allowlist
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = '123f18ad-9a45-4dcb-9527-61cb2be423d0'::uuid
$$;

-- Allow admins to read existing log tables
CREATE POLICY "Admins can read reminder run log"
  ON public.reminder_run_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read engagement run log"
  ON public.engagement_run_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read engagement sends"
  ON public.engagement_sends
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read broadcast log"
  ON public.broadcast_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Per-push tracking
CREATE TABLE public.push_send_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  source TEXT NOT NULL,
  title TEXT,
  body TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ,
  open_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB
);

CREATE INDEX idx_push_send_events_source_sent_at
  ON public.push_send_events (source, sent_at DESC);
CREATE INDEX idx_push_send_events_user_sent_at
  ON public.push_send_events (user_id, sent_at DESC);

ALTER TABLE public.push_send_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage push send events"
  ON public.push_send_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can read push send events"
  ON public.push_send_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Atomic open-tracking: callable by anyone holding the row id (eventId is the capability)
CREATE OR REPLACE FUNCTION public.record_push_open(_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.push_send_events
  SET opened_at = COALESCE(opened_at, now()),
      open_count = open_count + 1
  WHERE id = _event_id;
$$;

GRANT EXECUTE ON FUNCTION public.record_push_open(uuid) TO anon, authenticated;
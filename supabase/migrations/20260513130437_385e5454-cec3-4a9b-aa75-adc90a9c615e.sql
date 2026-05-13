-- Track engagement notification sends for cooldown enforcement
CREATE TABLE public.engagement_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX idx_engagement_sends_user_trigger_sent
  ON public.engagement_sends (user_id, trigger, sent_at DESC);

ALTER TABLE public.engagement_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage engagement sends"
  ON public.engagement_sends
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view own engagement sends"
  ON public.engagement_sends
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Run log for the engagement function
CREATE TABLE public.engagement_run_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  streak_sent INTEGER NOT NULL DEFAULT 0,
  comeback_sent INTEGER NOT NULL DEFAULT 0,
  recap_sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  expired_cleaned INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.engagement_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage engagement run log"
  ON public.engagement_run_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
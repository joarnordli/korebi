
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS reminder_window_start integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS reminder_window_end integer NOT NULL DEFAULT 21;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_window_valid
  CHECK (
    reminder_window_start BETWEEN 0 AND 23
    AND reminder_window_end BETWEEN 0 AND 23
    AND reminder_window_start <= reminder_window_end
  );

CREATE TABLE public.reminder_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  total_subscriptions integer NOT NULL DEFAULT 0,
  eligible integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  skipped_already_captured integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  expired_cleaned integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0
);

ALTER TABLE public.reminder_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage reminder run log"
ON public.reminder_run_log
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX reminder_run_log_run_at_idx ON public.reminder_run_log (run_at DESC);

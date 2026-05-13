
CREATE TABLE public.broadcast_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text,
  audience text NOT NULL,
  recipients_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  expired_cleaned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage broadcast log"
ON public.broadcast_log
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX broadcast_log_created_at_idx ON public.broadcast_log (created_at DESC);

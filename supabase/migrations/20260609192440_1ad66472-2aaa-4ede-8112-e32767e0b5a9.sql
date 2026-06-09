
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'cron_secret');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO service_role;

CREATE OR REPLACE FUNCTION public.record_push_open(_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.push_send_events
  SET opened_at = COALESCE(opened_at, now()),
      open_count = open_count + 1
  WHERE id = _event_id
    AND sent_at > now() - interval '14 days'
    AND open_count < 50;
$$;

REVOKE EXECUTE ON FUNCTION public.record_push_open(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_push_open(uuid) TO service_role;

DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE command ILIKE '%send-reminders%' OR command ILIKE '%send-engagement%'
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://evjpvgsmrojbnccgkoxv.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

SELECT cron.schedule(
  'send-engagement-hourly',
  '15 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://evjpvgsmrojbnccgkoxv.supabase.co/functions/v1/send-engagement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

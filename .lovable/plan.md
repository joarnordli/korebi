## Goal

Close the two "today" findings from the pre-launch audit:

- **B1** — `send-reminders` and `send-engagement` are publicly callable. Anyone on the internet can hit them and trigger push spam to every subscriber.
- **H3** — `record_push_open` is granted to `anon`, so anyone can corrupt push analytics for any event UUID.

We do this without breaking the scheduled cron, the in-app `?n=<eventId>` open detector, or the service worker's `notificationclick` handler.

---

## Scope (today)

In scope:
1. Add a shared `CRON_SECRET` and require it on `send-reminders` and `send-engagement`.
2. Update the pg_cron jobs that call these two functions to send the secret header.
3. Harden `track-push-open` + revoke `anon` access to `record_push_open`, while keeping the SW + in-app callers working.

Out of scope (later tiers): age gate (B2), DMCA/report (B3), email unsubscribe + postal address (B4), encryption salt (H1), paywall localStorage (H2), OAuth consent (H6), data export (H5).

---

## 1. Lock down `send-reminders` and `send-engagement` (B1)

### Approach
Keep `verify_jwt = false` (pg_cron does not have a user JWT). Instead, require **one of**:
- A valid `x-cron-secret` header matching the `CRON_SECRET` env var, **or**
- An `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` header (so admin tools / manual re-runs from the dashboard keep working).

Anything else → return `401`.

### Changes

**a. New secret**
- Add `CRON_SECRET` (random 32+ byte string) via `add_secret`. Exposed to both functions automatically.

**b. `supabase/functions/_shared/auth-cron.ts` (new shared helper)**
```ts
export function requireCronOrServiceRole(req: Request): Response | null {
  const cronHeader = req.headers.get("x-cron-secret");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && cronHeader && cronHeader === cronSecret) return null;

  const auth = req.headers.get("authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && auth === `Bearer ${serviceKey}`) return null;

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
```

**c. Edit `supabase/functions/send-reminders/index.ts`**
- Right after the OPTIONS preflight short-circuit, call `requireCronOrServiceRole(req)` and return its response if non-null.
- No other logic changes.

**d. Edit `supabase/functions/send-engagement/index.ts`**
- Same insertion as above.

**e. Migration: update existing pg_cron jobs**
The two functions are already scheduled in pg_cron (the audit confirmed they fire hourly). We need the cron command to add `x-cron-secret`. Because the SQL was added through the dashboard, write a migration that:

```sql
-- Pull the current schedules, then re-schedule with the secret header.
DO $$
DECLARE
  v_secret text := current_setting('app.cron_secret', true);
BEGIN
  -- noop here; secret is injected per job below via pg_net call body
END $$;

-- Unschedule old jobs if present (names are best-effort; harmless if missing)
SELECT cron.unschedule(jobid) FROM cron.job
 WHERE command ILIKE '%send-reminders%' OR command ILIKE '%send-engagement%';

-- Re-schedule send-reminders hourly
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

-- Re-schedule send-engagement hourly (same pattern)
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
```

The migration also inserts `CRON_SECRET` into Vault under name `cron_secret` so pg_cron can read it (Vault insert via `vault.create_secret`). We use the same value as the `CRON_SECRET` env var.

### Disruption check
- Cron continues firing on the same hourly schedules; only the header changes. No reminders are missed.
- Admin "send test" or manual invocations from the Supabase dashboard still work via service-role auth.
- Client app does not call these endpoints, so no frontend change is needed.

### Rollout order (single deploy window)
1. Add `CRON_SECRET` secret + insert into Vault as `cron_secret`.
2. Deploy updated `send-reminders` and `send-engagement` (they now accept *either* secret or service-role; this is backwards compatible until the cron jobs are updated).
3. Apply migration that re-schedules the cron jobs with the header.
4. Verify next cron tick in `reminder_run_log` / `engagement_run_log`.
5. Only after a successful tick: remove the service-role bypass? No — keep it; admins need it.

---

## 2. Harden `track-push-open` and lock `record_push_open` (H3)

### Approach
Two layered defenses, neither of which breaks the SW or in-app callers:

**Layer A — Revoke anon RPC grant.** The function uses the service-role client, so the public grant is unnecessary.

**Layer B — Validate eventId server-side before counting.** Only accept opens for events that:
- Exist in `push_send_events`,
- Were sent within the last 14 days,
- Have `open_count < 50` (sanity cap to neutralize replay loops).

This stops mass-corruption without requiring the SW to send a user JWT (which it can't reliably do on iOS).

### Changes

**a. Migration**
```sql
REVOKE EXECUTE ON FUNCTION public.record_push_open(uuid) FROM anon;
-- Keep authenticated grant so admin tools/dev console still work; the edge
-- function calls via service role and is unaffected by the grant change.

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
    AND created_at > now() - interval '14 days'
    AND open_count < 50;
$$;
```

**b. Edit `supabase/functions/track-push-open/index.ts`**
- Add per-event soft rate limit: reject if the function has already received >5 opens for the same `eventId` in the last 60 seconds. Track in an in-memory `Map<string, {count, ts}>` (instance-local, best-effort).
- Tighten CORS: continue to allow `*` (SW + arbitrary origin), but restrict allowed methods to `POST, OPTIONS` (already done) and drop `authorization` from allowed headers since none is required.
- Keep the existing UUID regex validation.

### Disruption check
- `public/sw.js` keeps POSTing to `/functions/v1/track-push-open` — unchanged.
- `src/App.tsx`'s `?n=<eventId>` detector keeps calling `supabase.functions.invoke("track-push-open", ...)` — unchanged.
- Legit users still get their open counted once; only attackers spamming the same event get throttled.
- No client code edits required.

---

## Verification (after build mode)

1. **Cron secret enforcement**
   - `curl -X POST https://.../functions/v1/send-reminders` → expect `401`.
   - `curl -X POST -H "x-cron-secret: <wrong>" ...` → `401`.
   - Check `reminder_run_log` after the next hour tick for a fresh row → confirms pg_cron path works.

2. **Push open tracking**
   - From the running app, trigger a test push and click it → `push_send_events.open_count` increments by exactly 1.
   - `psql` as anon role: `SELECT record_push_open('<uuid>')` → permission denied.
   - Spam `track-push-open` with the same UUID 20×: `open_count` stops climbing at ≤6.

3. **Smoke test** the live preview after deploy:
   - Reminders still arrive at the user's preferred window.
   - In-app `?n=` open detection still records.

---

## Files touched

```text
supabase/functions/_shared/auth-cron.ts            (new)
supabase/functions/send-reminders/index.ts          (+3 lines)
supabase/functions/send-engagement/index.ts         (+3 lines)
supabase/functions/track-push-open/index.ts         (+ rate-limit map)
supabase/migrations/<ts>_lock_cron_and_push_open.sql (new)
```

Secrets added: `CRON_SECRET` (also mirrored into Vault as `cron_secret` for pg_cron).

No frontend file is modified. No table schemas change. No data is deleted.

---

## Rollback

- **B1 fix:** redeploy the previous versions of `send-reminders` / `send-engagement` (or set `CRON_SECRET` to the value the cron job sends; if mismatched they 401 — the cron job re-schedule SQL is the only thing that can break delivery, and it's a single `cron.schedule` call that can be reverted to the previous command).
- **H3 fix:** `GRANT EXECUTE ON FUNCTION public.record_push_open(uuid) TO anon;` and restore the older two-line function body.

Ready to switch to build mode and execute.
## Phase 4 — Admin viewer + push engagement analytics

Two related additions to the Profile admin section: see what the cron jobs are doing, and measure how users actually respond to the notifications.

---

### Part A — Admin run viewer

A new collapsible card on `/profile` (admin-only, same hardcoded ID gate already used by the broadcast tool) that shows recent activity from the three log tables:

- **Reminder runs** (last 24h) — each hourly run with: time, total subs, eligible, sent, skipped (already captured), failed, expired cleaned, duration.
- **Engagement runs** (last 7 days) — each hourly run with: streak sent, comeback sent, recap sent, failed.
- **Broadcast log** (last 30) — title, audience, recipients, sent / failed / expired-cleaned, time.

Pulled directly via `supabase.from(...).select(...)` from the client. Today these tables only allow service-role access, so we add a small policy: rows are readable by clients **only when the caller's `auth.uid()` is in the admin allowlist**, enforced with a SQL helper `public.is_admin(_user_id uuid)` that hardcodes the same admin UUID server-side. (No new RPC, no edge function — just RLS.)

UI is read-only, with a Refresh button and timestamps localised to the user's tz.

---

### Part B — Push engagement tracking

Goal: for every push we send, know whether the recipient **opened the app from it**, so we can compare open-rates between trigger types (daily reminder vs. streak nudge vs. comeback vs. recap vs. broadcast).

#### Data model

One new table `push_send_events`:
- `id` uuid pk
- `user_id` uuid
- `source` text — `'reminder' | 'streak' | 'comeback' | 'recap' | 'broadcast' | 'test'`
- `title`, `body` text
- `sent_at` timestamptz
- `opened_at` timestamptz null
- `open_count` int default 0 (in case user clicks twice)
- `metadata` jsonb (e.g. broadcast_id, streak length, etc.)

Service-role full access; admins can read via the same `is_admin()` helper as Part A.

#### How sends get tagged

Each edge function (`send-reminders`, `send-engagement`, `send-broadcast`, `send-test-notification`) inserts a row into `push_send_events` **before** firing the push, captures the new `id`, and embeds it in the push payload as `eventId`. Push payload becomes:

```json
{ "title": "...", "body": "...", "url": "/?n=<eventId>", "eventId": "<uuid>" }
```

Failed sends update the row (or just leave `opened_at` null — they simply never get attributed).

#### How opens get recorded

Two complementary signals so we don't miss anything:

1. **Service worker** (`public/sw.js`) — on `notificationclick`, before opening the window, fire-and-forget a `fetch` to a new lightweight edge function `track-push-open` with `{ eventId }`. This works even if the user dismisses the page or the app fails to load.
2. **App load fallback** — `App.tsx` reads the `?n=<eventId>` query param on mount and, if present, calls the same edge function. Catches cases where the SW request was blocked (Safari sometimes drops background fetches). Then strips the param from the URL.

`track-push-open` (verify_jwt = false, no auth needed) just does:
```sql
update push_send_events
set opened_at = coalesce(opened_at, now()), open_count = open_count + 1
where id = $1
```
Idempotent — only the first open sets `opened_at`, but `open_count` keeps incrementing.

#### Insights panel (admin only)

A second card on Profile, "**Push performance**", showing aggregate stats for the last 30 days:

- **Per source**: sent / opened / open-rate %, sorted by open-rate.
- **Daily reminder open-rate over time** — a small sparkline (recharts) of the last 14 days.
- **Top 5 broadcasts** by open-rate with title + sent count.

Computed via two `select` queries grouped by `source` and by `date_trunc('day', sent_at)`.

---

### Order of work

1. **Migration**: `is_admin()` SQL helper, RLS reads on `reminder_run_log` / `engagement_run_log` / `broadcast_log`, new `push_send_events` table + RLS.
2. **`track-push-open` edge function** + register in `config.toml`.
3. Update **`send-reminders`**, **`send-engagement`**, **`send-broadcast`**, **`send-test-notification`** to insert a `push_send_events` row and embed `eventId` in payload + URL.
4. Update **`public/sw.js`** to ping `track-push-open` on `notificationclick`.
5. Update **`App.tsx`** to consume `?n=` on load and call the same endpoint.
6. Add **Admin Run Viewer** card and **Push Performance** card to `Profile.tsx`.

### Technical notes

- The `is_admin()` helper centralises the allowlist so we don't repeat the UUID in every RLS policy. Stored as `SECURITY DEFINER`, `STABLE`, with explicit `search_path = public`.
- `eventId` lives only in the encrypted push payload + the URL query param — no PII leaves the system.
- `track-push-open` accepts an `eventId` UUID, validates format with Zod, and is fully unauthenticated (the eventId is the capability). Worst case: someone guesses a UUID and inflates one row's open count — acceptable, and we still have `opened_at` as a "first open" signal.
- The SW fetch uses `keepalive: true` so it survives page navigation.
- Existing broadcast/reminder/engagement run-log tables are unchanged; we just add SELECT policies.

### Out of scope for now

- Per-user notification timeline (could add later from the same data).
- A/B testing different message copy (data is there once Part B is shipped, but no UI yet).
- Email-style unsubscribe links — push already has the per-user toggle.
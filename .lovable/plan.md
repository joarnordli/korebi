## Notification roadmap (3 phases)

Now that push delivery works end-to-end, here's a phased plan. Each phase ships independently so we can test before moving on.

---

### Phase 1 — Admin broadcast tool (your Profile)

Give you a private composer to send a custom push to all (or a slice of) users, gated to your user ID only.

**What you'll see**
- New "Admin" section visible only when your `user_id` matches a hardcoded constant.
- Form: Title, Body, optional URL (defaults to `/`), and an audience picker:
  - All users with reminders enabled
  - All push subscriptions (regardless of toggle)
  - Just me (dry run)
- "Preview" button shows the count of recipients before sending.
- "Send" requires a typed confirmation ("SEND") to avoid accidents.
- After send: a small report — sent / failed / expired-cleaned.

**Backend**
- New edge function `send-broadcast` (verify_jwt = true in code; rejects if caller's `user.id` ≠ admin ID).
- Reuses the same VAPID + `buildPushHTTPRequest` flow as `send-test-notification`.
- Iterates subscriptions in batches, captures per-endpoint status, cleans up 404/410.
- Logs each broadcast (new `broadcast_log` table: id, sent_by, title, body, audience, sent_count, failed_count, created_at) so you have an audit trail.

**Safety**
- Hardcoded admin ID in the function (server-side check — not just UI hiding).
- Rate limit: max 1 broadcast per minute per admin.

---

### Phase 2 — Polish daily reminders

Make the existing randomized daily reminder feel more thoughtful.

- **Per-user preferred window**: add `reminder_window_start` / `reminder_window_end` columns (default 10–21). Profile UI gets two simple time selects ("Morning–Evening", "Afternoon–Night", or custom).
- **Smarter messages**: expand the message pool, and skip the reminder entirely if the user has already captured today's memory (check `memories` for today in their tz before sending).
- **Better logging**: the `send-reminders` function already logs counts; add a small `reminder_run_log` table (run_at, eligible, sent, failed, expired) so you can see history at a glance.
- **Self-heal**: on `pushsubscriptionchange` failures, clear stale rows automatically.

---

### Phase 3 — Engagement triggers

Event-driven notifications, not just the daily one.

- **Streak nudge**: if a user is on a 3+ day streak and hasn't captured by their evening cutoff, send a streak-aware message ("Don't break your 5-day streak ✨"). Computed from `memories` rows.
- **Comeback**: if a user hasn't captured for 3 days, send a single gentle "We miss you" (then cool down for 7 days so it never feels spammy).
- **Monthly recap ready**: on the 1st of each month, push "Your [Month] recap is ready" linking to the feed filtered by month.
- All of these flow through one new `send-engagement` cron function that runs hourly and decides what (if anything) each user should get, respecting their timezone and a per-trigger cooldown table.

---

### Suggested order & validation

1. Ship Phase 1, send yourself a test broadcast, then a real one to all users when you're confident.
2. Ship Phase 2, watch the run log for a week.
3. Ship Phase 3 one trigger at a time (streak → comeback → recap), each with a cooldown so users never get more than one push per day total.

### Technical notes (for me)

- Admin gate: `const ADMIN_USER_IDS = new Set([...])` checked server-side in every admin function.
- New tables created via migration: `broadcast_log`, `reminder_run_log`, `engagement_sends` (user_id, trigger, sent_at — for cooldowns).
- All new edge functions registered in `supabase/config.toml`.
- Engagement cron added via `cron.schedule` using the existing pg_cron setup.
- Reuse the existing `vapidKeysToJWK` helper — extract it into a shared module to avoid duplication across 3 functions.

Want me to start with **Phase 1 only**, or queue up Phase 1 + 2 in one go?

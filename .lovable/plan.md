

## Plan: Push Notification Reminders with Smart Delivery

This is a multi-part feature: PWA push subscriptions, timezone-aware scheduling, and a cron-based delivery system.

### Architecture Overview

```text
User enables reminders (Profile)
  → Browser requests push permission
  → Push subscription saved to DB (with timezone)

Every hour (cron job):
  → Edge function checks: "whose 11 AM is it?"
  → Picks random minute offset per user (0-59)
  → Sends Web Push to each qualifying device
```

### 1. Database: New `push_subscriptions` table

```sql
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  reminder_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
```

RLS: authenticated users can CRUD their own rows only.

### 2. Service Worker (`public/sw.js`)

A minimal service worker that listens for `push` events and displays a notification. Registered from the app on load.

### 3. Frontend: "Enable Reminders" toggle (Profile page)

- New card in Profile with a `Switch` toggle for reminders
- On enable: request `Notification.permission`, call `pushManager.subscribe()` with VAPID public key, detect timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`, save subscription + timezone to `push_subscriptions` table
- On disable: delete subscription from DB and unsubscribe from push manager
- Show current state based on DB record

### 4. VAPID Keys (secrets)

Web Push requires a VAPID key pair. We need to generate one and store:
- `VAPID_PUBLIC_KEY` — used in frontend (stored in code, it's a public key)
- `VAPID_PRIVATE_KEY` — stored as a secret for the edge function

### 5. Edge Function: `send-reminders` (hourly cron)

- Runs every hour via `pg_cron`
- Gets current UTC hour
- Queries `push_subscriptions` where `reminder_enabled = true`
- Filters users whose local hour (based on stored timezone) equals 11 (the target notification hour)
- For each user, applies a deterministic random minute offset (hash of user_id + date → 0-59) — but since cron runs hourly, it just sends immediately with the "human feel" being that different users get it at different seconds within the function execution
- Sends Web Push notification using the `web-push` library with VAPID credentials
- Cleans up invalid/expired subscriptions (410 responses)

### 6. Cron Job Setup

```sql
SELECT cron.schedule(
  'send-daily-reminders',
  '0 * * * *',  -- every hour at :00
  $$ SELECT net.http_post(...) $$
);
```

### Files to create/modify

| File | Action |
|------|--------|
| `public/sw.js` | Create — service worker for push events |
| `src/main.tsx` | Edit — register service worker |
| `src/pages/Profile.tsx` | Edit — add reminders toggle card |
| `supabase/functions/send-reminders/index.ts` | Create — hourly push sender |
| `supabase/config.toml` | Edit — register new function |
| Migration | New table `push_subscriptions` |
| Secret | `VAPID_PRIVATE_KEY` (need to generate and add) |

### Prerequisites before implementation

1. Generate a VAPID key pair (can be done via a one-time script or online tool)
2. Store `VAPID_PRIVATE_KEY` as a secret
3. Store `VAPID_PUBLIC_KEY` in code (it's public)
4. Enable `pg_cron` and `pg_net` extensions

### Smart Delivery detail

Instead of a truly random minute (which would require 60 cron runs), the edge function runs once per hour and sends notifications to all qualifying users within that single invocation. The "human feel" comes from:
- A small random delay (`setTimeout`) per user (0-30 seconds spread) within the function
- Different users in different timezones naturally receive at different UTC times


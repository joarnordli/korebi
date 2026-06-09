## Simplify Admin Broadcast Audience

You're right — since the in-app reminder toggle was removed, every subscription row is created with `reminder_enabled: true`. So "All users with reminders ON" and "All push subscriptions" now target the same people. The dropdown is redundant.

### Changes

**`src/components/AdminPanel.tsx`** (broadcast composer)
- Remove the "Audience" label + `<Select>` dropdown and its state.
- Replace the single "Send" button with two side-by-side buttons:
  - **"Send test to myself"** → sends with `audience: "self"` (your UID only). Useful dry run.
  - **"Send to all push subscribers"** → sends with `audience: "all_subscriptions"`. Requires the typed-confirmation modal (kept as-is).
- The recipient-preview count still runs (preview call) before the confirm modal opens for the "all" button so you see how many devices will receive it.

**`supabase/functions/send-broadcast/index.ts`**
- Keep accepting `"self"` and `"all_subscriptions"`.
- Remove the `"all_enabled"` branch (or alias it to `"all_subscriptions"` for safety — I'll alias to avoid breaking any in-flight call).

**Not changing**
- VAPID, rate limit, broadcast_log, admin allowlist, daily 6 AM–12 PM cron in `send-reminders` (still filters `reminder_enabled = true`, which is fine — all current rows are true).

### Note
The daily cron's `reminder_enabled` filter is now effectively a no-op but harmless. Leaving it in keeps an off-switch path open if you ever want one again.

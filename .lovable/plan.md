## Goal

Remove the user-facing reminders toggle from Profile and switch to a native browser/PWA permission flow that's triggered right after the user saves their first memory. Keep all admin tools intact.

## Admin verification

Confirmed: **exactly one admin user** has access to broadcast push and admin tools — `joarsvendsennordli@gmail.com` (uid `123f18ad-9a45-4dcb-9527-61cb2be423d0`). This UUID is hardcoded in three places (Profile.tsx, send-broadcast edge function, and the `is_admin()` SQL helper). All three agree. No other user can send extra pushes outside the daily 6 AM–12 PM cron.

## Behavior changes

**1. New "first capture" push opt-in flow**
- After `CaptureScreen` saves the user's first-ever memory (memory count went from 0 → 1), check `Notification.permission`:
  - `"default"` → call `Notification.requestPermission()` immediately, then if granted, subscribe and upsert `push_subscriptions` with `reminder_enabled: true`, window `6–12` (6 AM–12 PM), timezone.
  - `"denied"` → do nothing this session (browser blocked; can't re-prompt).
  - `"granted"` → silently subscribe + upsert row if no subscription exists yet.
- If the prompt was shown and the user picked "Block" (or dismissed), set a localStorage flag `okiro:push_prompt_dismissed = 1` and show an **inline banner** on the Today tab, placed **directly under** the "Today's moment captured / come back tomorrow / streak" block:
  - Text: "Get a gentle daily nudge — Enable reminders"
  - Tap → re-runs `Notification.requestPermission()` (works only if the user hasn't permanently blocked; otherwise we toast: "Enable notifications in your browser/device settings.")
  - Small "×" dismisses the banner for the session.
- Banner does **not** appear if `Notification.permission === "granted"` or if the user is on a device without push support, or on iOS Safari that isn't installed to home screen (we already detect this).

**2. Remove the reminders section from Profile (for non-admins)**
- Delete the entire "Daily reminders" card: toggle, window slider (10 AM–10 PM picker), and "Send test notification" button — for normal users.
- **Keep the admin section unchanged**: broadcast composer + "Send test notification" remain visible to the admin UID only.
- Admin still sees their own enable toggle? → No. Admin uses native permission like everyone else. Test-notification button stays under the admin panel.

**3. Default reminder window: 6 AM – 12 PM**
- When the new code path upserts `push_subscriptions` on first capture, set `reminder_window_start = 6`, `reminder_window_end = 12`.
- No UI lets users edit the window anymore — it's fixed.
- Existing users keep whatever window they already have in the DB (no migration; their row stays as-is).

**4. Off-switch for users**
- No in-app off toggle. Users disable via browser/OS notification settings (Safari/Chrome settings → Notifications → okiro.online → Block, or iOS Settings → Okiro → Notifications). The `pushsubscriptionchange` handler in `sw.js` won't re-subscribe a revoked permission, so it self-cleans.

## Technical notes

**Files to edit**
- `src/components/CaptureScreen.tsx` — after successful `saveMemory`, call a new `maybePromptForPush()` helper.
- `src/lib/push.ts` *(new)* — extract the permission/subscribe/upsert logic currently inside Profile's `handleToggleReminders` into a reusable function. Hardcode window 6/12. Used by both the first-capture flow and the inline banner.
- `src/pages/Index.tsx` — render an `<EnablePushBanner />` under the "today captured" block on the Today tab when `Notification.permission === "default"` and `localStorage.okiro:push_prompt_dismissed === "1"` (i.e. they declined the auto-prompt). Component handles its own visibility.
- `src/components/EnablePushBanner.tsx` *(new)* — small dismissible inline card.
- `src/pages/Profile.tsx` — remove the user-facing reminders card; keep admin broadcast + admin test-notification button. Drop now-unused state (`remindersEnabled`, `windowStart`, `windowEnd`, `handleToggleReminders`, `handleSaveWindow`). Keep `handleSendTest` (admin only).

**Edge cases handled**
- iOS Safari not installed to home screen → skip auto-prompt and skip banner (would just frustrate).
- Already-subscribed user (e.g. enabled it previously via old toggle) → no prompt, no banner.
- Detecting "first capture": pass `memories.length === 0` from `useMemories` into `CaptureScreen` as a prop, then trigger the helper only when that was true at save time.

**Not changing**
- `sw.js`, edge functions, cron schedule, admin UID, `push_subscriptions` schema, default reminder content/copy.

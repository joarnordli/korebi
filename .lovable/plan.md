
# Okiro – Full App Audit

Findings from a full pass over every screen, hook, lib, edge function, RLS policy, and the PWA/notification flow. Grouped by severity. Nothing is changed yet — pick which items you want me to fix.

---

## Critical (broken or data-losing)

### 1. "Download all memories" is broken since encryption was added
`Profile.tsx → handleDownload()` does:
- `supabase.from("memories").select("*")` — returns the raw `image_url` (now a **storage path** like `<userId>/<uuid>.webp`, not a URL), and never reads `encryption_iv`.
- Then `fetch(memory.image_url)` — fetching a relative path from `okiro.online` which 404s, or returns HTML.
- Even if it fetched the correct signed URL, it would zip the **encrypted ciphertext** as `.webp` / `.jpg`. Nothing in that zip would open.
- Filename extension is parsed from `.split(".")` of a path without a query string — wrong for legacy http URLs too.

Result: the only export path the user has is silently producing unreadable archives. Critical, because the Profile page literally promises "Your memories are always yours."

Fix: reuse `getMemories()` (which already decrypts), then `fetch(memory.image_url)` against the resulting `blob:` URL, derive extension from `blob.type`.

### 2. Subscription lapse locks users out of their own data
`memories` table RLS is `auth.uid() = user_id AND has_active_subscription(auth.uid())` for SELECT.
- After a trial ends or a subscription lapses, users **cannot read their own memory rows** — the Subscribe screen is the only thing they see.
- They can't download or export before paying again, contradicting the "your memories are always yours" copy.
- Storage RLS on the bucket itself is owner-only (no subscription check), so the files exist but are unreadable without the IV column.

Recommendation: keep INSERT/UPDATE/DELETE gated on subscription, but allow SELECT for the owner regardless. Then expose a "read-only" mode (no capture, no edit) plus the data export when lapsed.

### 3. Push subscription upsert references a non-existent unique constraint
`Profile.tsx` does `upsert(..., { onConflict: "user_id,endpoint" })`, but the `push_subscriptions` table has **no unique index on (user_id, endpoint)**. Postgres will throw `there is no unique or exclusion constraint matching the ON CONFLICT specification`, so toggling reminders on fails entirely on a second attempt (or ever, depending on Supabase behavior).

Fix: add `UNIQUE (user_id, endpoint)`.

### 4. Decrypted blob URLs leak forever (memory bloat)
`getMemories()` calls `URL.createObjectURL(blob)` for every encrypted memory on every fetch. We previously removed `revokeObjectURL` from `MemoryCard` to keep cached URLs valid — correct fix at the time — but now every refresh / pull-to-refresh / tab switch that triggers a re-decrypt allocates fresh blob URLs and orphans the previous ones. On a heavy user (hundreds of memories) the leak is significant.

Fix options (pick one):
- Cache decryption results by `(memory.id, encryption_iv)` in a module-level `Map`, reuse the same blob URL across refreshes.
- Or: revoke old URLs in `getMemories` before creating new ones (after diffing against the previous result set).

---

## High

### 5. Service worker registers inside Lovable preview iframe
`main.tsx` registers `/sw.js` unconditionally. Per the project's PWA guidelines, registering a SW inside the Lovable preview iframe causes stale content and routing weirdness in the editor preview. Should guard against `window.self !== window.top` and the `lovableproject.com` / `id-preview--` hostnames.

### 6. SW has no `pushsubscriptionchange` handler
When a browser rotates an endpoint (Chrome does this periodically; Safari does it on PWA reinstall), there's nothing to re-subscribe and update the row. The user silently stops receiving reminders, and `send-reminders` keeps trying until it gets 410/404 and prunes them.

Fix: add a `pushsubscriptionchange` listener in `public/sw.js` that re-subscribes with the same VAPID key and POSTs the new endpoint to a new edge function (or back through the existing flow).

### 7. iOS PWA push gotcha — needs explicit handling
On iOS Safari, push notifications **only work if the app was added to the Home Screen** and the user has opened it from there. Toggling reminders in a normal Safari tab silently fails on iOS < 16.4 and only works in the installed PWA on ≥16.4. Right now the UI shows "enabled" but the user gets nothing. We should:
- Detect `window.navigator.standalone || matchMedia('(display-mode: standalone)').matches` and show a "Add to Home Screen first" hint on iOS Safari before allowing the toggle.

### 8. `navigator.serviceWorker.ready` can hang forever
In `Profile.handleToggleReminders`, if SW registration silently failed (e.g., file 404, mixed content, blocked), `await navigator.serviceWorker.ready` never resolves and the toggle UI stays stuck. Add a timeout race (e.g. 5s) and a clear error toast.

### 9. Stripe checkout success URL bypasses the success handler
`create-checkout` sends users back to `/?checkout=success`. `ProtectedRoute` runs first; if the subscription cache hasn't refreshed yet it redirects to `/subscribe` and **the query string is stripped** by `<Navigate replace />`. The `useEffect` in `Subscribe.tsx` that handles `?checkout=success` is effectively dead code. The toast and forced refresh inside `Index.tsx`'s effect also rarely fires for the same reason.

Fix: send Stripe back to `/subscribe?checkout=success`, let Subscribe handle the toast + `checkSubscription`, then redirect once `subscribed` flips true.

---

## Medium

### 10. iOS HEIC images from the photo library will fail
`compressImage()` uses `<img>` decoding, which doesn't support `image/heic` / `image/heif` in Chrome/Firefox and is inconsistent on iOS Safari. Library uploads from iPhones often arrive as HEIC. Result: "Failed to load image for compression" toast.

Fix: detect HEIC mime/extension up front and either reject with a clear message ("Please choose JPEG, PNG or WebP") or use a HEIC decoder library.

### 11. `getEncryptionSalt` salt cache survives sign-out
`cachedSalt` is a module-level singleton. After signOut + signIn as a different account in the same tab, the cached salt is reused. This is actually fine for security (same server-side secret for all users), but worth flushing on sign-out for hygiene + to match what we'd do if salt rotation is ever introduced.

### 12. `send-reminders` window is exactly one hour — easy to miss
The cron runs hourly at `:00`. Eligibility is `currentHour === targetHour` in the user's timezone. If the cron is delayed >60 min (cold-start, retries, deploy), the user gets nothing that day. Also if their timezone offset doesn't align with whole hours (e.g., India +5:30, Nepal +5:45), `getCurrentHourInTimezone` rounds and the matching window is fragile.

Fix: store a "last_sent_date" per subscription, and treat eligibility as `currentHour >= targetHour AND last_sent_date < today`.

### 13. Push subscription rows accumulate per device
Even when `onConflict` is fixed (issue #3), users get one row per browser/device. There's no UI to see / revoke individual devices, and disabling reminders deletes **all** rows for the user. Acceptable for v1, worth noting.

### 14. Auto-switch to Memories tab is unconditional after capture
`Index.tsx` flips to "Memories" the moment `todayCaptured` becomes true. Users who want to retake or edit today's photo right after saving have to navigate back manually, then enter edit mode on the new card. Minor UX friction.

---

## Low / nits

- `Auth.tsx` uses `emailRedirectTo: window.location.origin` — should be the full URL the user should land on after confirmation (`/`).
- `Profile.tsx` `checkReminders` query reads `id, reminder_enabled` but ignores per-device rows; if a user has 3 devices and one is enabled, the toggle reflects whichever row comes back first.
- `formatDate` builds dates with `T12:00:00` (local time) — fine, but be aware DST transitions in some timezones can shift the rendered weekday by one for memories captured around midnight.
- `compressImage` has no max input dimension guard — extremely large source images (50 MP+) will allocate a >200 MB canvas before failing.
- `MemoryCard.handleShare` parses extension from `blob.type.split("/")[1]` — for `application/octet-stream` (legacy unencrypted edge case) this would name the file `okiro-memory.octet-stream`. Not reachable today but brittle.
- `index.html` `<meta name="viewport" ... maximum-scale=1>` disables pinch-zoom — accessibility concern (WCAG 1.4.4).

---

## What I'd fix first (suggested order)

1. **#1 Download bug** + **#2 SELECT-after-lapse** — these are the worst because they prevent users from getting their own data out.
2. **#3 push upsert constraint** + **#5 SW iframe guard** + **#6 pushsubscriptionchange** + **#7 iOS PWA hint** — the whole notification stack is fragile, and these four together make it solid on installed PWAs.
3. **#4 blob URL leak** + **#9 Stripe success URL** — quality fixes that are quick.
4. Everything else as polish.

Tell me which subset you want and I'll implement it. If you want all of them, I'll batch the encryption/feed fixes and the notification fixes into two reviewable steps.

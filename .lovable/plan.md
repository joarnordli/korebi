## Add iOS PWA Badge Count

Use the Web Badging API so the Okiro home-screen icon shows a notification count on iOS 16.4+ (and supported Android/desktop PWAs), and clears it when the user opens the app or taps a notification.

### Behavior

1. **On push received** (service worker): increment a persisted badge counter and call `navigator.setAppBadge(count)` on the SW registration / `self`.
2. **On notification click** (service worker): clear the counter and call `self.navigator.clearAppBadge()` before focusing/opening the window.
3. **On app focus / startup** (main app): always call `navigator.clearAppBadge()` and reset the persisted counter — so launching the app from the home screen icon (not just from a notification) also wipes the badge and clears any lingering notifications.
4. **On visibility change → visible**: same clear, so returning to the app from background also resets it.
5. **Close lingering notifications**: in the SW activation / on app open, call `self.registration.getNotifications()` and `.close()` each one so Notification Center is emptied alongside the badge.

### Technical changes

- **`public/sw.js`**
  - Add a tiny IndexedDB (or `caches`-backed JSON) counter helper — `localStorage` is not available in SW. Use a single `Cache` entry (`badge-count` → `Response` with number) for simplicity, or an in-memory + `clients.matchAll` postMessage fallback.
  - In the existing `push` handler: read counter, increment, write back, then `self.navigator.setAppBadge?.(newCount).catch(()=>{})`.
  - In `notificationclick`: reset counter to 0, `self.navigator.clearAppBadge?.()`, and close all `self.registration.getNotifications()`.
  - On `message` event with `{ type: "CLEAR_BADGE" }` from the page: reset counter, clear badge, close notifications. Used by the app on focus/startup.

- **`src/main.tsx`** (or a new tiny `src/lib/badge.ts` imported there)
  - On load, on `visibilitychange` (when visible), and on `focus`: call `navigator.clearAppBadge?.()` and `postMessage({ type: "CLEAR_BADGE" })` to the active SW so the SW-side counter and any open notifications are also cleared.
  - Feature-detect (`"setAppBadge" in navigator`) and silently no-op otherwise.

- **No DB / RLS / edge function changes.** Push payload already exists; we just react to it client-side.

### Out of scope

- Server-side unread-count source of truth. Counter is a simple "unseen pushes since last app open" — matches user's requested behavior.
- Android/desktop are auto-supported by the same API where available.
- No changes to auth, subscription gate, capture flow, or persisted React Query.

### iOS prerequisites (already met)

- Installed via Add to Home Screen ✅ (existing PWA manifest)
- Notification permission granted ✅ (existing push flow)
- Calls `setAppBadge()` ✅ (this change)

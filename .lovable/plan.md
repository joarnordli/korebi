# Faster cold-start plan

The pulsing logo you see on a cold launch is the app waiting on **two slow things in series** before it can render anything:

1. `useAuth` → `checkSubscription` → calls the `check-subscription` edge function → which hits **Stripe** (this is the biggest single delay, often 1–3s).
2. `useMemories` → React Query has no cache after a cold start, so it re-fetches the memory list + signed image URLs from scratch before the feed shows.

`ProtectedRoute` blocks render until both `loading` and `subscriptionLoading` are false, so the logo just sits there.

Below are quick, high-impact changes — no new dependencies except a small, official React Query persistence helper.

## Changes

### 1. Optimistic subscription gate (biggest win)
- Cache the last `checkSubscription` result in `localStorage` (subscribed flag + timestamp).
- On boot, hydrate `subscribed` from cache **immediately** and let `ProtectedRoute` render based on it.
- Revalidate against the edge function in the background; if it changes, update state (and redirect to `/subscribe` only if it flipped to false).
- Net effect: returning subscribed users skip the Stripe round-trip on the critical path entirely.

### 2. Persist React Query cache to localStorage
- Add `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister` (official, tiny).
- Persist the `memories` and `hasTodayMemory` queries with a 24h max age.
- The Memories feed renders instantly from cache on cold start, then silently refreshes.

### 3. Skeleton instead of blank logo
- Replace the full-screen pulsing logo in `Index.tsx` with a lightweight skeleton of the header + tab bar + 2–3 memory card placeholders (using existing `Skeleton` component).
- Perceived load time drops even when network is slow.

### 4. Lazy-load heavy Profile dependencies
- `react-leaflet` + `leaflet` CSS and `AdminPanel` are pulled in eagerly by `Profile.tsx` and contribute to the initial JS bundle (Profile is already lazy, but its imports balloon the chunk).
- Convert the map block and `AdminPanel` to `React.lazy` inside Profile so they only load when that section is actually visible.

### 5. Preconnect to backend
- Add `<link rel="preconnect">` and `<link rel="dns-prefetch">` for the Supabase URL in `index.html` so the TLS handshake to the backend overlaps with HTML parsing.

## Out of scope (intentionally)
- No service worker / offline caching changes (the existing `sw.js` stays as-is for push).
- No changes to encryption, capture flow, or backend logic.
- No bundler/Vite config changes beyond what the persist plugin needs.

## Files touched
- `src/hooks/useAuth.tsx` — hydrate `subscribed` from localStorage, background revalidate.
- `src/App.tsx` — wrap with `PersistQueryClientProvider`; relax `ProtectedRoute` gating.
- `src/pages/Index.tsx` — skeleton loading state.
- `src/pages/Profile.tsx` — lazy map + AdminPanel.
- `index.html` — preconnect/dns-prefetch.
- `package.json` — add the two query-persist packages.

Expected result: returning users see the UI in well under a second on cold start; first-time users see a skeleton instead of a blank logo screen.
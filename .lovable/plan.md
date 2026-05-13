## Problem

After the persistence work, the app hydrates the `memories` React Query cache from localStorage instantly — but the cached `image_url` values are stale:

- For encrypted memories (the default), `image_url` is rewritten in `getMemories()` to a `blob:` URL created from `URL.createObjectURL()`. Those blob URLs only exist in the previous tab/process and are **dead on reload**.
- For unencrypted memories, the cached value is a signed Storage URL that may also be expired.

Because the query has a 5-minute `staleTime`, React Query treats the hydrated cache as fresh and does **not** refetch on mount. The feed renders broken image placeholders until the user pull-to-refreshes (which calls `getMemories` again, re-signs URLs, and re-decrypts blobs).

## Fix

Keep the snappy boot, but stop persisting the field that goes stale.

### 1. Exclude `memories` from persistence (`src/App.tsx`)

In the `dehydrateOptions.shouldDehydrateQuery` filter, persist **only** `hasTodayMemory` (a plain boolean — safe to hydrate). Drop `memories` from the allow-list.

Result: on cold start the "Today" tab still renders instantly with the right state (captured / not captured, streak badge later) and the Memories tab shows the existing skeleton while the real fetch runs — same skeleton path as today, just for one quick fetch instead of forever-broken images.

### 2. Force a fresh fetch on mount for memories (`src/hooks/useMemories.ts`)

Add `refetchOnMount: "always"` to the `memories` query as a belt-and-suspenders guard, so even if a stale entry sneaks into the in-memory cache (e.g. via React fast refresh) we still re-resolve URLs.

### 3. (Optional, no behavior change) Bump persistence buster

Change `buster: "v1"` → `"v2"` in `App.tsx` so existing users with the bad persisted `memories` payload drop it on first load instead of reading a stale entry once.

## Files

- `src/App.tsx` — narrow `shouldDehydrateQuery`, bump `buster`.
- `src/hooks/useMemories.ts` — `refetchOnMount: "always"` on the memories query.

## Out of scope

No changes to encryption, capture flow, auth, or the subscription cache. The optimistic auth/sub gate and lazy-loading from the previous round stay exactly as-is.



## Plan: Fix image loading with caching

### Root cause
Every visit to the feed calls `getMemories()` which makes N+1 requests: 1 DB query + 1 `createSignedUrl` call per memory. Signed URLs change each time, so browser HTTP cache never hits. Navigating away discards all state.

### Solution: Three layers of caching

#### 1. React Query for data caching
Replace manual `useState` + `useEffect` with `useQuery` from TanStack React Query (already installed). This keeps memories in memory across navigations with a stale-while-revalidate pattern.

- Create a `useMemories` hook wrapping `useQuery({ queryKey: ['memories'], queryFn: getMemories, staleTime: 5 * 60 * 1000 })`
- Use it in both `Index.tsx` and anywhere else that needs memories
- Data survives navigation between pages without refetching

#### 2. Batch signed URL generation
Replace N individual `createSignedUrl` calls with a single `createSignedUrls` (plural) call — the storage SDK supports batch signing.

In `getMemories()`:
```ts
const paths = memories.map(m => extractStoragePath(m.image_url));
const { data } = await supabase.storage.from("memories").createSignedUrls(paths, 3600);
```

This cuts N network requests down to 1.

#### 3. Longer signed URL expiry + URL stability
Increase signed URL expiry from 1 hour to 24 hours. Cache the signed URL mapping in memory so repeated calls within a session reuse existing URLs (browser HTTP cache then works too).

### Files to modify

| File | Change |
|------|--------|
| `src/lib/memories.ts` | Batch `createSignedUrls`, add in-memory URL cache |
| `src/hooks/useMemories.ts` | New — React Query hook for memories + streak |
| `src/pages/Index.tsx` | Use `useMemories` hook instead of manual state |
| `src/pages/Profile.tsx` | Use `useMemories` hook for streak/map data |

### Expected improvement
- Returning to feed after profile: **instant** (cached data, no refetch)
- Cold load: **1 DB query + 1 batch sign request** instead of 1 + N
- Reopening after idle: stale data shown immediately, fresh data swapped in background


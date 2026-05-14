## Problem

After capture, the Memories tab still shows stale data and the Today tab still shows the capture UI. Only a full app restart reveals the saved memory. Cause: removing `refresh()` from `handleSaved` removed the only thing that invalidated React Query's cache. With `staleTime` of 5 min on memories and 60 s on `hasTodayMemory`, the queries never refetch, so `todayCaptured` stays `false` and the new memory never appears in the feed.

The earlier flicker concern was actually a non-issue: `loading` is `isLoading`, which only flips true on the *initial* fetch (when there's no cached data). Background refetches set `isFetching`, not `isLoading`, so invalidating after a save will not re-show the skeleton.

## Fix (single file: `src/pages/Index.tsx`)

Re-add invalidation to `handleSaved`, but keep it non-blocking and run it *after* the tab switch so the transition stays smooth:

```ts
const handleSaved = () => {
  setTab("memories");
  // Fire-and-forget invalidation. Won't flip `loading` (isLoading) because
  // both queries already have cached data — only `isFetching` toggles, which
  // the UI does not gate on.
  refresh();
};
```

The existing skeleton gate `loading && memories.length === 0` already prevents any skeleton flash even in edge cases.

## Verification

1. Capture a memory.
2. Tab transitions to Memories; the new card appears within ~1 s without a skeleton flash.
3. Switch back to Today → shows "Today's moment captured" (not the capture UI).
4. No need to force-quit and reopen.

## Out of scope

CaptureScreen, useMemories, save logic, animations, backend, or RLS.
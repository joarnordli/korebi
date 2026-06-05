# Rediscover feed — experimental third feed

A new tab that surfaces the user's existing memories in a non-chronological, truly random order so older moments resurface. It reuses the data already in memory — no duplicate storage, no extra fetches.

## Answers to your open questions

**1. Third button in the glass nav**
The current pill holds two labelled buttons. Three labels at 390px would feel cramped and break the "thumb-friendly pill" feel. Approach:

- Keep the pill shape, switch the three items to **icon + short label** (`Today`, `Memories`, `Relive`) with slightly tighter padding (`h-11 px-4`, `gap-1.5`).
- Use `Shuffle` (lucide) as the Relive icon. The accent dot stays only on `Today` when uncaptured.
- If width gets tight on very small devices, the labels collapse to icon-only via a `@media (max-width: 360px)` rule — pill geometry preserved.

**2. Pulling images without duplication**  
The Relive feed reads from the **same** `useMemories()` **React Query cache** that powers the chronological feed. No new query, no new storage bucket, no re-download — it just renders a reordered view of the array already in memory (signed URLs + decrypted blob URLs are reused as-is).

**3. True scramble (non-predictable)**
Use **Fisher–Yates shuffle seeded from `crypto.getRandomValues**` every time a fresh shuffle is requested. No deterministic seed (no date-based, no user-id-based), so two visits never produce the same order. The shuffled order is held in a `useRef` for the lifetime of the tab session so scrolling doesn't reshuffle on every render — but it is regenerated on:

- first entry into the Relive tab,
- pull-to-shuffle again,

**4. Edits reflected across feeds**
Already handled by the existing architecture: editing a memory invalidates the `["memories"]` query in React Query, which is the single source of truth for all three feeds. The Relive view derives from that same array (matching by `id`), so updated notes/images appear everywhere on the next render. No extra wiring needed beyond keying the shuffled list by `memory.id`.

**5. Reshuffling when a new memory is captured**
Reshuffling the whole feed on every capture is wasteful and jarring. Strategy:

- The shuffle is **not** pre-built on app open — it's lazily computed the first time the Relive tab is opened (cheap: Fisher–Yates on a few hundred items is sub-millisecond).
- When a new memory is saved, we **do not reshuffle**. Instead the new memory is **spliced into a random index** of the existing shuffled array (single `crypto.getRandomValues` call). This preserves the user's current relive session and costs O(1).
- A full reshuffle only happens on the triggers listed in (3).

## Implementation outline

### Files touched

- `src/pages/Index.tsx` — add `"relive"` to the `Tab` union, render the new view, add the third nav button.
- `src/components/ReliveFeed.tsx` *(new)* — shuffled view + "Shuffle again" control.
- `src/lib/shuffle.ts` *(new)* — `secureShuffle<T>(arr: T[]): T[]` using Fisher–Yates + `crypto.getRandomValues`, and `insertAtRandomIndex<T>(arr, item)`.
- `src/hooks/useRelive.ts` *(new)* — wraps `useMemories`, maintains a `useRef<Memory[]>` of the shuffled order, reconciles on memory add/remove/edit by `id`, exposes `{ memories, reshuffle }`.
- `src/index.css` — minor tweak to `.glass-pill` inner spacing if needed; add the `@media (max-width: 360px)` icon-only rule for nav labels.

### Reconciliation rules in `useRelive`

On every change to the underlying `memories` array:

- Build a `Set` of current ids.
- Remove from the shuffled ref any id no longer present.
- For each new id not yet in the ref, `insertAtRandomIndex` it.
- For existing ids, swap the reference in-place so edits (note/image_url) propagate without changing order.
- Result: stable shuffle session, edits/new items reflected, no full reshuffle until the user asks for one.

### MemoryCard reuse

`ReliveFeed` reuses `MemoryCard` unchanged so edit/delete flows already invalidate the shared query — no duplicate edit logic.

### Out of scope

- No backend changes, no migrations, no new storage.
- No changes to the chronological `MemoriesFeed`, capture flow, or swipe-between-tabs gesture (we'll extend the swipe to cycle through three tabs in a follow-up if you want — flagging it here but leaving it out of this plan).

## Open question for you

Do you want the **left/right swipe** between tabs to also cycle into Relive (Today → Memories → Relive), or should Relive only be reachable via the nav pill? Either is fine; the first is more discoverable, the second keeps the swipe gesture's mental model simpler. ADMIN ANSWER: Yes, I want the left/right swipe between tabs to also cycle into Relive
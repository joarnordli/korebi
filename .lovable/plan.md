## Reduce app padding for bigger, more engaging images

### Problem
Horizontal padding across the Today capture screen and Memories feed is quite generous (`px-6` / `px-4`), which makes photos feel smaller than they could be on a mobile viewport.

### Proposed changes
Tighten padding in three components while preserving the rounded-card aesthetic and safe breathing room:

| File | Current | New |
|------|---------|-----|
| `src/components/MemoriesFeed.tsx` | `px-4 pb-24 space-y-4` | `px-2 pb-24 space-y-3` |
| `src/components/MemoryCard.tsx` card wrapper | `p-2` | `p-1` |
| `src/components/MemoryCard.tsx` text block | `px-2 pt-3 pb-2` | `px-2.5 pt-2 pb-1.5` |
| `src/components/CaptureScreen.tsx` root | `px-6 pt-4 pb-8` | `px-4 pt-3 pb-8` |
| `src/components/CaptureScreen.tsx` preview wrapper | `p-2` | `p-1` |

### Why this works
- On a 390 px-wide phone, shaving ~12 px of horizontal padding (8 px from the feed + 4 px from the card) makes the 3:4 photo area noticeably larger.
- `space-y-3` instead of `space-y-4` keeps the feed compact without losing separation.
- The rounded corners (`rounded-2xl` on the card, `rounded-xl` on the image) still provide enough visual framing even with 4 px of internal padding.
- The header/tab bar stays at `px-6`, so the slightly narrower cards still feel anchored to the layout above.

### No other changes needed
No routing, logic, or backend work. Purely presentational spacing tweaks.
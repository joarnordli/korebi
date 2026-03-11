

## Fix: Last memory card cut off in feed

### Problem
The `MemoriesFeed` component has only `pb-8` (32px) bottom padding. On mobile, the last card's note text gets clipped because there's not enough scroll room at the bottom of the container.

### Solution
Increase the bottom padding on the feed container from `pb-8` to `pb-24` to ensure the last card (including its note text) is fully scrollable into view. This also accounts for any safe-area insets on notched devices.

### File change
| File | Change |
|------|--------|
| `src/components/MemoriesFeed.tsx` | Change `pb-8` → `pb-24` on line 26 |




## Problem

The layout uses `position: fixed` for the header + `paddingTop` spacer on the scroll container. This creates **two independent touch/scroll zones** on iOS: one over the header area and one over the feed. Touching the header scrolls the underlying content differently than touching the feed — confusing and non-standard.

## Solution

Replace the `fixed` header with a **flexbox layout** where the header is a static (non-scrolling) flex child and the feed is the only scrollable area. This eliminates:
- The dual scroll zones entirely
- The need for `paddingTop` spacer / `ResizeObserver` hack
- Content appearing behind the header on initial load

The header still gets the translucent blur effect via `backdrop-blur` — content scrolls behind it visually because the scroll container sits below it in the DOM, not overlapping.

### Changes to `src/pages/Index.tsx`

1. **Outer container**: Keep `h-screen flex flex-col overflow-hidden`
2. **Header**: Change from `fixed` to a normal flex child — remove `fixed top-0 left-0 right-0 z-10`, remove `ref`/`ResizeObserver`
3. **Scroll container**: Remove `paddingTop: headerHeight` style — it naturally flows below the header in flexbox
4. **Remove** `headerRef`, `headerHeight` state, and the `ResizeObserver` `useEffect` (no longer needed)

The header becomes a non-scrolling block at the top; the feed (`flex-1 overflow-y-auto`) is the only scrollable area, occupying the remaining viewport height.

### Files
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Replace fixed-position header with flex layout; remove ResizeObserver code |


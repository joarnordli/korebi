

## Problem

The scrollable content area uses a hardcoded `pt-[180px]` to offset below the fixed header. The actual header height varies slightly depending on font rendering, device, and dynamic content — so sometimes the feed's first card starts partially behind the header.

The header itself is `position: fixed` with no defined height, while the scroll container relies on a magic number to clear it.

## Solution

Use a `ref` on the fixed header and dynamically measure its height via `ResizeObserver`. Apply that measured height as `paddingTop` on the scroll container instead of the hardcoded `180px`.

### Changes to `src/pages/Index.tsx`

1. Add a `ref` to the fixed header wrapper div (line ~83)
2. Add state: `const [headerHeight, setHeaderHeight] = useState(180)` (sensible default)
3. Add a `useEffect` with `ResizeObserver` on the header ref to update `headerHeight` whenever it resizes
4. Replace `className="... pt-[180px]"` on the scroll container (line 143) with `style={{ paddingTop: headerHeight }}`

This ensures the feed always starts exactly below the header regardless of device or rendering differences, while still allowing content to scroll behind the translucent header.

### Files
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Replace hardcoded `pt-[180px]` with dynamic header height measurement |


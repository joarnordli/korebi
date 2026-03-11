

## Plan: Fixed Header with Scrollable Content

The current `sticky` approach fails because the pull-to-refresh indicator sits above the header in the DOM, pushing it down as you scroll. The fix is to use `fixed` positioning for the header and make only the content area scrollable beneath it.

### Changes to `src/pages/Index.tsx`

1. **Header container**: Change from `sticky top-0` to `fixed top-0 left-0 right-0` with `max-w-md mx-auto` to match the app width. Keep the existing `backdrop-blur-xl bg-background/70` and fade-out gradient.

2. **Content area**: Add top padding equal to the header height (~180px) so content starts below the fixed header, and make it the scroll container.

3. **Pull-to-refresh**: Move inside the content area (below the header spacer) so it doesn't interfere with the fixed header.

4. **Outer container**: Change from `overflow-y-auto` to `overflow-hidden` with `h-screen`, making the content div the actual scroll target. Update `containerRef` to point at the content div instead.

### Single file change
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Restructure layout: fixed header, scrollable content below |




## Plan: Sticky Frosted-Glass Header

Make the header (logo, title, profile button, tab switcher) stick to the top with a translucent blurred background and a soft fade-out edge at the bottom.

### Changes to `src/pages/Index.tsx`

1. **Wrap header + tabs in a sticky container** with `sticky top-0 z-10`
2. **Apply frosted-glass styling**: `backdrop-blur-xl bg-background/70` (beige tint at 70% opacity + blur)
3. **Add a fade-out pseudo-element** at the bottom of the sticky area — a 24px tall gradient from `background/70` to transparent, using an absolutely positioned `div` with `pointer-events-none`
4. **Move scroll to the outer container** — the outer `div` stays as the scroll container, header sticks inside it
5. **Pull-to-refresh indicator** stays above the sticky header (already natural since it's before it in DOM)

### Visual result
- Header stays fixed while scrolling
- Content scrolls behind with a soft blur + beige tint visible through the header
- Bottom edge fades out smoothly instead of a hard line
- No accessibility issues — blur + color tint keeps text readable

### Files to modify
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Wrap header+tabs in sticky div with backdrop-blur and fade gradient |


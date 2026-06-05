## Move the Today / Memories switcher to the bottom of the screen

Right now the tab switcher sits in the header alongside the Okiro logo and avatar. We'll relocate it to a floating bottom bar styled like a native iOS glass control, so the photo content above gets even more room and the primary navigation lives where the thumb naturally rests.

### Changes

1. **`src/pages/Index.tsx`**
   - Remove the tab segmented control from the header block. Header keeps only the Okiro wordmark + profile avatar, making it visibly slimmer.
   - Add a new floating bottom bar fixed inside the app's `max-w-md` shell:
     - Positioned with `absolute bottom-0` inside the existing flex shell (so it stays inside the locked PWA viewport, no overlap with iOS home indicator).
     - Padding-bottom uses `env(safe-area-inset-bottom)` so it sits above the home indicator on iPhone.
     - Two tabs (Today / Memories) with the same icons + "new" badge dot logic as today.
   - Update the scrollable content container's `paddingBottom` to reserve space for the bar (roughly `calc(env(safe-area-inset-bottom) + 76px)`) so the last memory card isn't hidden behind the glass.
   - Apply the same treatment to the loading skeleton so the layout doesn't jump.

2. **Glassmorphism styling (semantic, theme-aware)**
   - Add a small reusable utility in `src/index.css` (e.g. `.glass-bar`) that combines:
     - `backdrop-filter: blur(24px) saturate(180%);` with `-webkit-backdrop-filter` for iOS Safari.
     - Translucent background using existing tokens: `background: hsl(var(--background) / 0.72);`
     - Hairline top border: `border-top: 1px solid hsl(var(--border) / 0.6);`
     - Subtle top shadow for lift.
   - Works in light and dark mode automatically via the tokens we just added for dark mode.
   - Fallback: when `backdrop-filter` is not supported, fall back to opaque `hsl(var(--background))` via `@supports not`.

3. **Active tab affordance**
   - Selected tab: filled pill (`bg-secondary text-foreground`) with icon + label.
   - Inactive tab: `text-muted-foreground`, icon + label, no fill.
   - Tap target ≥ 44px tall to match iOS HIG.
   - Keep the existing accent dot on Today when the user hasn't captured yet.

### Out of scope

- No changes to swipe-to-switch gestures, capture flow, or memories feed itself.
- No new dependencies.
- No backend changes.

### Files

- `src/pages/Index.tsx` — move tabs, adjust paddings, update skeleton.
- `src/index.css` — add `.glass-bar` utility class.



## Problem

From the screenshot, the header area (logo, tagline, tab switcher) still responds to touch/scroll gestures independently. The outer container uses `overflow-hidden` but on iOS, touch events on the header area can still propagate and cause scroll-like behavior on the page body or the outer container.

## Root Cause

1. The outer `h-screen overflow-hidden` container doesn't have `overscrollBehavior: none` or `touch-action` constraints — iOS can still bounce/scroll it
2. The header `div` (shrink-0) doesn't prevent touch-move events from bubbling — so dragging on the header can still move content
3. The `body`/`html` elements may also be scrollable on iOS PWA

## Solution

### 1. Lock the page-level scroll (`src/index.css`)
Add `overflow: hidden` and `overscroll-behavior: none` to `html, body` to prevent any page-level scrolling on iOS.

### 2. Block touch scrolling on the header (`src/pages/Index.tsx`)
Add `touch-action: none` CSS and an `onTouchMove` handler with `e.preventDefault()` on the header wrapper div. This prevents any vertical drag on the header from creating scroll movement.

### 3. Keep `overscrollBehavior: none` on the feed container
Already in place — ensures the feed doesn't rubber-band into the header area.

### Files
| File | Change |
|------|--------|
| `src/index.css` | Add `html, body { overflow: hidden; overscroll-behavior: none; }` |
| `src/pages/Index.tsx` | Add `touch-action: none` style + `onTouchMove={e => e.preventDefault()}` to the header wrapper div (line 83) |


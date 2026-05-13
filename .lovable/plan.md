# Visual & iOS polish

## 1. Stop iOS from zooming on input focus

**Cause:** iOS Safari/WebKit auto-zooms when a focused input/textarea has a computed font-size below 16px. The capture note `<textarea>` uses `text-sm` (14px), which triggers the zoom. Once zoomed, iOS doesn't always restore scale cleanly when the keyboard dismisses — that's the same root cause as issue #2.

**Fix:**
- `index.html`: update the viewport meta to disable user scaling so focus never triggers zoom:
  `content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"`
- As a belt-and-suspenders measure, bump the capture note `<textarea>` in `src/components/CaptureScreen.tsx` from `text-sm` to `text-base` (16px) so even browsers that ignore `maximum-scale` won't zoom. Keep visual size consistent by leaving padding as-is.

This is the standard PWA fix and is consistent with the app already running as a standalone iOS PWA (`apple-mobile-web-app-capable`).

## 2. Header "stuck to top" after saving

This is the same iOS zoom artifact: after the textarea-induced zoom, the visual viewport stays scaled until the user pinch-zooms out. Locking `maximum-scale=1.0` (fix #1) prevents the initial zoom, so the header can never end up stuck. No additional layout change needed — verify in preview after deploying fix #1.

## 3. Tighten Profile header

Currently `src/pages/Profile.tsx` header uses `pt-12 pb-6` plus a `mb-6` on the Back button, leaving a large empty band above the avatar/name (visible in screenshot).

**Changes (`src/pages/Profile.tsx`, header block around lines 410–431):**
- Reduce top padding: `pt-12` → `pt-4` (status bar is handled by the iOS PWA chrome, not the web view).
- Reduce header bottom padding: `pb-6` → `pb-4`.
- Reduce Back-button bottom margin: `mb-6` → `mb-3`.
- Make the identity row a touch larger and more present:
  - Avatar `w-12 h-12` → `w-14 h-14`.
  - Title `text-xl` stays, but tighten `gap-3` → `gap-3.5`.
- Keep email truncation as-is.

Result: avatar + name move up ~40–50px and feel front-and-center, matching the screenshot ask without restructuring the layout.

## Out of scope
- No business logic, data, or routing changes.
- No changes to `Index.tsx` header (only Profile was called out).

## Verification
- Reload preview on iPhone, open Today → tap photo → focus the note: confirm no zoom.
- Save the memory: confirm header on Memories tab stays in place with no pinch needed.
- Open Profile: confirm the avatar/name sit near the top with the streak card immediately visible.
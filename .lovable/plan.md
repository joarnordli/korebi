Add tap-to-scroll-top behavior: tapping the static header background scrolls the main content area smoothly to the top, mirroring the native iOS status-bar tap pattern.

Changes in `src/pages/Index.tsx`:
- Attach `onClick` to the static header wrapper that calls `containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })`.
- Prevent conflicts with interactive elements:
  - The profile `<button>` already stops the event from reaching the scroll handler via its own `onClick` + `navigate("/profile")`, but to be safe we add `e.stopPropagation()` on the profile button's click handler.
  - The scroll-to-top handler checks `e.target === e.currentTarget` OR uses `closest('button, a, [role="button"]')` to bail out when the tap originates from any interactive child (profile avatar, future header buttons).
- Add `cursor-pointer` only to the non-interactive header area (logo + title), leaving the profile button's existing cursor behavior intact.
- No changes to swipe handlers, pull-to-refresh, or the floating glass nav.

Out of scope: tapping the iOS status bar itself (not reachable from web/Capacitor web view without native plugin) — this gives the same UX by making the visible header tappable.
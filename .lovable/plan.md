# Dark mode support

Add a fully themed dark palette and let users choose Light / Dark / Device default from their Profile. The PWA already reads `prefers-color-scheme` automatically once we wire it up.

## What gets built

1. **Dark palette in `src/index.css`**
   - The `.dark { ... }` block already exists but was never tuned for Okiro's warm cream/orange brand. Rework the dark tokens so:
     - Background: deep warm charcoal (not pure black) — keeps the warm Okiro feel.
     - Cards: a touch lighter than background for elevation.
     - Primary/accent: keep the orange hues but slightly desaturated so they don't glare on dark.
     - Borders/muted: warm low-contrast grays.
     - Shadows (`--shadow-card`, `--shadow-elevated`): increase opacity since shadows are subtler on dark.
   - Update `<meta name="theme-color">` dynamically (light = `#E8607A`/current cream, dark = the new dark bg) via a small effect, so the iOS/Android status bar matches.

2. **Theme manager `src/lib/theme.ts`**
   - Stores preference in `localStorage` under `okiro.theme` with values `"light" | "dark" | "system"`.
   - `applyTheme(pref)` toggles the `.dark` class on `<html>` based on preference (resolves `system` via `matchMedia('(prefers-color-scheme: dark)')`).
   - Subscribes to `matchMedia` changes so when preference is `system` and the OS flips, the app reacts live.
   - Updates the `theme-color` meta tag whenever the resolved theme changes.

3. **`useTheme` hook `src/hooks/useTheme.ts`**
   - Returns `{ preference, resolved, setPreference }`.
   - Initializes from storage (default `"system"`) and wires the matchMedia listener.

4. **Boot-time flash prevention**
   - Add a tiny inline script in `index.html` `<head>` that reads `localStorage.okiro.theme` and adds the `.dark` class before React mounts — prevents a light→dark flash on load.
   - Also set the initial `theme-color` meta from that script.

5. **Profile UI — Appearance section**
   - New section above "Notifications" titled **Appearance**.
   - Three-option segmented control (Light / Dark / Device) using the existing button/toggle styling — matches the rest of Profile's minimalist look.
   - Selecting an option calls `setPreference(...)`; takes effect immediately.

6. **Audit hardcoded colors**
   - Scan `Landing`, `Auth`, `legal/*`, `MemoryCard`, `MemoriesFeed`, `CaptureScreen`, `Profile`, `Subscribe` for any literal colors (`bg-white`, `text-black`, hex values) and swap to semantic tokens so dark mode actually looks right. Only fix what's broken under dark — don't refactor visuals in light mode.

## Out of scope

- No auto-scheduling (e.g. "dark at sunset") — only the three options requested.
- No per-page overrides.
- No new dependencies (`next-themes` is already pulled in by sonner but we won't depend on it directly to keep this lightweight and aligned with the existing CSS variable system).

## Files touched

- `src/index.css` — refine `.dark` tokens
- `src/lib/theme.ts` (new)
- `src/hooks/useTheme.ts` (new)
- `index.html` — pre-hydration script + dynamic theme-color
- `src/main.tsx` — call `initTheme()` early
- `src/pages/Profile.tsx` — Appearance section
- Spot fixes in components/pages that use literal colors

## Notes

- No backend changes — preference is local to each device (matches typical OS-level theme behavior).
- The PWA manifest `theme_color` stays as the light brand color; the runtime `<meta name="theme-color">` handles dynamic switching for the browser chrome.

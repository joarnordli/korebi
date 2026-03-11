

## Plan: Streak Counter + Photo Location Map

### 1. Streak Counter on Profile Page

**No database changes needed.** Query the user's memory dates and compute the streak client-side.

- Create a helper `getStreak(memories)` in `src/lib/memories.ts` that counts consecutive days backward from today/yesterday
- Add a streak display card on the Profile page (fire emoji + number + "day streak")
- Query memory dates on profile load (lightweight: just `select date`)

### 2. Photo Location Map

**Database change:** Add `latitude` and `longitude` nullable float columns to `memories` table.

**At upload time (`src/lib/memories.ts`):**
- Parse EXIF data from the image file using a lightweight EXIF reader (we'll add the `exif-reader` or use a small inline parser — no heavy dependency needed; we can read EXIF GPS tags from the ArrayBuffer directly)
- Store extracted lat/lng when saving a memory

**On Profile page:**
- Install `leaflet` + `react-leaflet` for an interactive map
- Show a small map card with markers for all memories that have coordinates
- Use OpenStreetMap tiles (free, no API key)

### Files to modify/create

| File | Change |
|------|--------|
| `src/lib/memories.ts` | Add `getStreak()` function; extract EXIF GPS on save |
| `src/lib/exif.ts` | New — lightweight EXIF GPS parser (no dependency) |
| `src/pages/Profile.tsx` | Add streak card + map card |
| DB migration | Add `latitude` and `longitude` columns to `memories` |

### Dependencies to add
- `leaflet` + `react-leaflet` (map rendering)

### Notes
- Existing memories will show no location (columns nullable)
- Photos without GPS (screenshots, etc.) will simply have null coordinates
- Map only shows if at least one memory has location data


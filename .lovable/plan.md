

## Plan: Fix "Choose from Library" on iPhone

### Problem
The `<input>` on line 55 has `capture="environment"`, which on iOS Safari forces the camera to open directly — it skips the photo library option entirely. There is no separate "library" button; the single input always opens the camera.

### Solution
Split into two buttons and two hidden inputs:

1. **"Take Photo" button** — triggers a hidden input with `capture="environment"` (opens camera directly)
2. **"Choose from Library" button** — triggers a hidden input *without* the `capture` attribute (opens the standard iOS picker which shows the photo library)

### Changes to `src/components/CaptureScreen.tsx`

- Add a second `<input type="file" accept="image/*">` ref (`libraryRef`) without the `capture` attribute
- Replace the single upload button with two side-by-side buttons:
  - Camera icon + "Take Photo" → triggers `fileRef` (keeps `capture="environment"`)
  - Image icon + "From Library" → triggers `libraryRef` (no `capture` attr)
- Both inputs share the same `handleFile` callback
- Keep the rest of the flow (preview, note, save) unchanged

### Files
| File | Change |
|------|--------|
| `src/components/CaptureScreen.tsx` | Add second input + two-button layout |


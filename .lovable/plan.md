

# Client-Side Image Compression (WebP)

## Overview
Add a compression utility that resizes and converts images to WebP before upload. This will reduce typical photo sizes from 3-8MB to ~100-250KB, dramatically improving load times.

## Changes

### 1. New file: `src/lib/image-compress.ts`
- Canvas-based resize + WebP conversion utility
- Max dimension: 1200px (preserves aspect ratio)
- WebP quality: 0.8
- Fallback to JPEG 0.85 if browser doesn't support WebP canvas export
- Returns a `File` object ready for upload
- Key detail: EXIF GPS must be extracted from the **original** file before compression (Canvas strips EXIF)

### 2. Update `src/components/CaptureScreen.tsx`
- Import `compressImage` from the new utility
- In `handleFile`: extract GPS from original file first, then compress, store compressed file in state, use canvas data URL for preview
- In `handleSave`: pass the pre-extracted GPS coords to `saveMemory` so we don't lose location data
- Update `saveMemory` call signature to accept optional GPS coords

### 3. Update `src/components/MemoryCard.tsx`
- In `handleImageChange`: compress the replacement image before storing in state
- No GPS concern here since edits don't update GPS

### 4. Update `src/lib/memories.ts`
- `saveMemory`: accept optional `gps` parameter so coords extracted from the original (pre-compression) file can be passed through, since the compressed WebP will have no EXIF
- Validation will pass since WebP is already in `ALLOWED_TYPES`

## Technical Notes
- EXIF extraction happens on the original file **before** compression, so GPS data is preserved in the database even though the uploaded WebP has no EXIF
- No changes to existing stored images — they continue to work as-is
- No visual or UX changes — same capture flow, same card layout


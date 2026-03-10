

# Fix: Server-Side File Type Validation for Image Uploads

## Problem
File uploads only rely on the browser's `accept="image/*"` attribute, which is trivially bypassed. No MIME type, magic byte, file size, or extension validation happens before uploading to storage.

## Plan

### 1. Add a `validateImageFile` utility in `src/lib/memories.ts`

A shared validation function that performs three checks before any upload:

- **Magic bytes**: Read the first 4-12 bytes of the file using `FileReader`/`ArrayBuffer` to verify the file signature matches JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`52 49 46 46...57 45 42 50`), or GIF (`47 49 46 38`).
- **MIME type**: Check `file.type` against an allowlist (`image/jpeg`, `image/png`, `image/webp`, `image/gif`).
- **File size**: Reject files larger than 10 MB.

If any check fails, throw a descriptive error.

### 2. Rename files to UUIDs

Replace user-controlled filenames with `crypto.randomUUID()` to prevent directory traversal and information leakage:

- `saveMemory`: path becomes `{userId}/{uuid}.{ext}` instead of `{userId}/{date}.{ext}`
- `updateMemory`: path becomes `{userId}/{uuid}.{ext}` instead of `{userId}/{memoryId}.{ext}`

The extension is derived from the validated magic bytes (not from the filename), mapping the detected type to a safe extension.

### 3. Apply validation in both upload paths

Call `validateImageFile(imageFile)` at the top of `saveMemory` and `updateMemory` before any storage call. This returns the safe extension to use.

### 4. Add server-side MIME restriction on the storage bucket (migration)

Add a SQL migration to update the `memories` bucket with `allowed_mime_types` restricted to `image/jpeg, image/png, image/webp, image/gif` as a secondary enforcement layer at the storage level.

### Files Changed
- `src/lib/memories.ts` — add validation function, apply to both upload paths, UUID rename
- New migration — restrict bucket allowed MIME types


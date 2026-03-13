

## Plan: Share Memory Feature

### Approach decision: Web Share API (download-based)

Your privacy concern about shareable links is valid — sequential/guessable tokens would let anyone enumerate other users' memories. While this can be mitigated with long random tokens (e.g. UUID v4 — 122 bits of randomness, practically unguessable), it still means hosting publicly accessible images, which conflicts with the private nature of Okiro.

**Recommended approach: Use the Web Share API with the actual image file.** This calls the native share sheet (what you called "ShareKit") and shares the image + text directly — no public URL needed, no privacy risk. The image is fetched from the signed URL, converted to a file blob, and passed to `navigator.share({ files, text })`.

Fallback for browsers without file sharing support: download the image instead.

### UI change: Popover menu on three-dot button

Replace the current `MoreHorizontal` button (which directly enters edit mode) with a Popover menu containing two options:
- **Edit** — enters edit mode as before
- **Share** — triggers the share flow

### Share content format

The shared content will be:
- **File**: The memory image (downloaded from the signed URL as a blob)
- **Text**: `"A memory from {formatted date}" + note` (if note exists)

No link, no public URL — just the image and caption text sent through the native share sheet.

### Files to modify

| File | Change |
|------|--------|
| `src/components/MemoryCard.tsx` | Replace direct edit button with Popover menu (Edit + Share). Add share handler that fetches image blob and calls `navigator.share()` with file + text. Fallback to download if share API unavailable. |

### Share handler logic

```text
1. Fetch image from memory.image_url (already a signed URL)
2. Convert response to blob → File
3. Check navigator.canShare({ files: [file] })
4. If yes → navigator.share({ files: [file], text: "A memory from {date}\n{note}" })
5. If no  → Create download link, trigger click, toast "Image downloaded"
```

No database changes, no new tables, no edge functions needed.


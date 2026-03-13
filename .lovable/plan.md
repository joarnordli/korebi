

## Plan: Improve share fallback for desktop browsers

### Change to `src/components/MemoryCard.tsx` — `handleShare` function

Replace the current two-tier logic (file share OR download) with three tiers:

1. **File share supported** (mobile) → `navigator.share({ files, text })` — full native share sheet with image + text
2. **Text-only share supported** (desktop Safari/Chrome) → Download image + `navigator.share({ text })` — user gets the share sheet for the caption, image saves to downloads
3. **No share API** (older browsers) → Download image + copy text to clipboard with toast

```text
if canShare({ files }) → share files + text          (mobile)
else if navigator.share exists → download image + share text  (desktop with share API)
else → download image + copy text to clipboard               (fallback)
```

### File
| File | Change |
|------|--------|
| `src/components/MemoryCard.tsx` | Update `handleShare` with 3-tier fallback logic |

Note: The full "pick a contact → prefill message" flow is a native OS capability that works on mobile. Desktop browsers have limited share sheet support — this is a browser limitation, not something we can work around in code. On mobile (which is the primary use case for Okiro), the experience will be exactly as you described.


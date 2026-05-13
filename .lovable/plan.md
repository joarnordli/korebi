## Tighten Profile spacing

The scroll container (`src/pages/Profile.tsx` line 433) sits flush against the header above and the footer below, so the streak pill looks clipped at the top and the Delete account button crowds the bottom on device.

**Change (line 433):**
- `flex-1 overflow-y-auto px-6 space-y-4` → `flex-1 overflow-y-auto px-6 pt-2 pb-4 space-y-4`

That adds ~8px breathing room above the streak card and ~16px below the danger-zone button before the footer. No other layout, logic, or styling changes.

**Verification:** Reload Profile on iPhone — streak card top edge has visible gap from header; Delete account button sits comfortably above the © Okiro footer.

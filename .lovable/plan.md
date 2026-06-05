Replace the popover menu on each memory card with two vertically stacked, circular glass buttons (Share on top, Edit below) — no labels, separated by a gap, inside a transparent shared container.

Changes in `src/components/MemoryCard.tsx`:
- Keep the three-dot `MoreHorizontal` trigger and `Popover` state, but restyle the `PopoverContent`:
  - Override default popover styling by passing `className` with `bg-transparent border-0 shadow-none p-0 w-auto` so the container becomes invisible.
  - Inside, render a `flex flex-col gap-2 items-center` wrapper holding two circular icon buttons.
- Each button: `w-11 h-11 rounded-full glass-pill flex items-center justify-center` (reuses the existing `.glass-pill` token already used by the bottom nav for consistent iOS glass look). Icons only — `Share2` on top, `Pencil` below. Add `aria-label` for accessibility.
- Remove the inline text labels ("Edit", "Share", "Sharing…"); show transient state via icon opacity/disabled state only (button gets `disabled:opacity-50` while sharing).
- Use `side="bottom" align="end"` (current default) so the stack opens just under the dots.

No changes to share/edit logic, glass token, or other files.
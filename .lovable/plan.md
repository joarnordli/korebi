

## Plan: Update "Today's moment captured" screen

### Changes to `src/pages/Index.tsx` (lines 178-187)

1. **Remove the circle background** — replace the `div` wrapper with just the `<img>` tag (no rounded-full bg container)
2. **Add streak counter** — display the `streak` value (already available from `useMemories`) below the subtitle

```
<img src={okiroLogo} alt="Okiro" className="w-10 h-10 mb-4" />
<p className="font-display text-lg text-foreground">Today's moment captured</p>
<p className="font-body text-sm text-muted-foreground mt-1">Come back tomorrow for a new memory</p>
{streak > 0 && (
  <div className="mt-4 flex items-center gap-1.5 text-accent">
    <span className="text-2xl font-display font-bold">{streak}</span>
    <span className="font-body text-sm text-muted-foreground">day streak 🔥</span>
  </div>
)}
```

### Files
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Remove circle wrapper, add streak display |


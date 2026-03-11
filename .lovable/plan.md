

## Plan: Hard-edge header with gradual opacity

Two changes to the fixed header in `src/pages/Index.tsx`:

### 1. Remove the fade-out gradient
Delete the "Fade-out edge" `div` (lines 147-152) entirely.

### 2. Gradual background opacity (top-to-bottom)
Replace the flat `bg-background/70` on the header container (line 95) with an inline CSS `background` using a linear gradient from 100% opacity at the top to 70% at the bottom. Keep `backdrop-blur-xl`.

```
background: linear-gradient(to bottom, hsl(var(--background)), hsl(var(--background) / 0.7))
```

### Files
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Remove fade-out div, replace flat bg with gradient bg |


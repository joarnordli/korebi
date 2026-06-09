### Scope
Two small UX improvements to `src/pages/Auth.tsx` — no backend or database changes.

### 1. Confirm Password (signup only)
- Add `confirmPassword` state.
- Render a second password input below the first, only when `mode === "signup"`.
- On every keystroke in either password field, compare `password` and `confirmPassword`.
- If both fields have ≥1 character and do **not** match, show inline red text: "Passwords do not match".
- If they do match and both have ≥6 characters, show inline green text: "Passwords match".
- Disable the "Create account" button until passwords match and are ≥6 characters.

### 2. Generic login error
- When `mode === "login"` and `supabase.auth.signInWithPassword` throws, toast:
  "Could not sign in – username or password incorrect."
  instead of the raw `err.message`.
- Keep raw Supabase messages for signup errors (they're useful, e.g. "User already registered").

### Files touched
- `src/pages/Auth.tsx` (only file)

### No-op items
- No changes to OAuth flow, consent gate, or any other component.
- No database or edge-function changes.
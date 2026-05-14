## Goal

Make the "Your free trial has ended" screen feel personal and harder to walk away from by:
1. Showing **who is signed in** (so users on multiple accounts know which one they're about to pay for).
2. Highlighting **how many memories** they've already saved, as a winback hook.

## Changes

All changes are in `src/pages/Subscribe.tsx`. No backend, RLS, or schema changes are needed — the SELECT policy on `memories` already lets a signed-in user read their own rows regardless of subscription state.

### 1. Signed-in user identifier

Pull `user` from `useAuth()` and render a small identity row above the card:

- Avatar (from `user.user_metadata.avatar_url`, fallback to initials/User icon — same pattern already used in `Index.tsx`).
- Display name (`user.user_metadata.full_name`) on top, email underneath in muted text.
- A small "Not you? Sign out" link to the right, wired to the existing `signOut` (already imported).

This makes account switching one tap away and removes the "wait, which account is this?" hesitation.

### 2. Memory count for winback

Fetch the count once on mount with a lightweight query (no image URLs needed):

```ts
const { count } = await supabase
  .from("memories")
  .select("id", { count: "exact", head: true })
  .eq("user_id", user.id);
```

Store in local state. Then change the card heading dynamically:

- **0 memories** → keep current copy: "Your free trial has ended".
- **1 memory** → "Subscribe to keep your 1 memory safe".
- **2+ memories** → "Subscribe to keep your **{count} memories** safe".

The number gets a slightly larger font / accent color so it pops. Subhead copy adjusts to match: "Don't lose the moments you've already captured. Resubscribe to keep adding to your timeline."

While the count is loading, fall back to the current generic heading (no skeleton flicker).

## Out of scope

- No changes to pricing, checkout, or auth flow.
- No new tables, edge functions, or RLS policies.
- No changes to `Landing` or `Index` copy.

## Technical notes

- The Subscribe page already runs inside `SubscribeRoute`, so `user` is guaranteed to exist.
- Use `count: "exact", head: true` so we don't pull row data — fastest possible query.
- Wrap the count fetch in a try/catch and silently fall back to generic copy on failure.

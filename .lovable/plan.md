## Plan: Delete Account

### 1. Delete Account (full data wipe)

This requires a new backend function since account deletion needs `service_role` access.

**New edge function: `delete-account**`

- Authenticates user via JWT
- Deletes all user's files from the `memories` storage bucket
- Deletes rows from `memories`, `profiles`, `subscriptions` tables for that user
- Cancels any active Stripe subscription
- Deletes the Stripe customer
- Deletes the user from `auth.users` via admin API
- Returns success

**Frontend (Profile.tsx)**

- Add a "Danger zone" section at the bottom with a "Delete account" button
- Show an AlertDialog confirmation with clear warning text ("This will permanently delete all your memories, photos, and account data")
- Require typing "DELETE" to confirm
- On confirm, call the edge function, sign out, redirect to `/welcome`

### 3. Config update

Add `verify_jwt = false` for the new `delete-account` function in `supabase/config.toml` (we validate JWT manually in code).

### Files to create/modify

- **Create** `supabase/functions/delete-account/index.ts`
- **Edit** `src/pages/Profile.tsx` — add cancel + delete account sections
- No database migrations needed (existing tables have `ON DELETE CASCADE` or we delete manually)
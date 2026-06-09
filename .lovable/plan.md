# Admin Dashboard — separate route with full insights

## Goal
Pull every admin-only UI out of the Profile page and into a dedicated, admin-gated route at `/admin`. Add a richer set of business / health metrics useful for fundraising and stakeholder updates.

## Access control
- Route `/admin` rendered only when `is_admin(auth.uid())` returns true (already exists as a DB function and as `isAdmin` state in Profile).
- Non-admins hitting `/admin` → redirect to `/profile`.
- A small "Admin dashboard" link appears in Profile **only** for admins (replacing the inline panels). Everyone else sees nothing.

## What moves out of Profile.tsx
Remove these three blocks (lines ~302–391):
1. Admin · Broadcast panel
2. Admin · Test push panel
3. `<AdminPanel />` (push insights)

Also remove the now-unused admin imports/state from Profile (`Megaphone`, `Send`, `bcTitle/bcBody/bcUrl/bcResult`, `handleSendTest`, broadcast handlers, AdminPanel lazy import).

## New page: `src/pages/Admin.tsx`
Tabbed layout using existing `@/components/ui/tabs`:

```text
┌──────────────────────────────────────────────┐
│  Overview │ Users │ Push │ Revenue │ Tools   │
└──────────────────────────────────────────────┘
```

### Tab 1 — Overview (KPI grid)
Top-line numbers at a glance, each as a small stat card with delta vs previous period where possible:
- Total users (all-time) + new in last 7 / 30 days
- DAU / WAU / MAU (derived from `memories.created_at` distinct user_id per window)
- Active subscriptions (count where `subscriptions.active = true`)
- Trials in progress (profiles where `is_trialing` from check-subscription cache OR via Stripe; use `subscriptions` + a heuristic)
- Trial → paid conversion rate (paid subs ÷ trial signups in window)
- Churn rate (cancellations last 30d ÷ active subs at period start) — requires a small new view or Stripe call; v1 will compute from `subscriptions.active` deltas
- Total memories captured + avg per active user
- Storage used (sum from `memories` storage bucket; see "Technical" below)
- Push subscribers (count of `push_subscriptions`)

### Tab 2 — Users
- Table: most recent 50 signups (`profiles.created_at`, display_name, memories count, subscription state, storage MB)
- Sort/filter by: signup date, subscriber state, storage
- Per-user storage column: bytes in `memories` bucket under `userId/` prefix, computed via an edge function (cached 10 min)
- CSV export button (writes via `Blob` download)

### Tab 3 — Push
Existing `AdminPanel` content (open-rate by source, 14-day sparkline, recent broadcasts, reminder runs, engagement runs). No behavior change.

### Tab 4 — Revenue
- MRR estimate (sum of active subscription prices) — via new edge function `admin-stripe-metrics` calling Stripe
- Active subscribers by plan
- New paid subs / cancellations last 7 & 30 days
- Lifetime revenue (sum of Stripe charges, last 90 days for cost reasons)
- Trial → paid funnel

### Tab 5 — Tools
The action panels currently on Profile:
- Broadcast composer (title / body / URL / "Send to all push subscribers")
- Test push (send to my devices)
- (Future placeholder) Resend last reminder, purge expired subscriptions

## Routing
- Add `<Route path="/admin" element={<Admin />} />` in `src/App.tsx`.
- `Admin.tsx` wraps content in an `AdminGuard` component that checks `useAuth().user` then calls `supabase.rpc('is_admin', { _user_id: user.id })`; while loading shows a skeleton; on false `navigate('/profile', { replace: true })`.

## Technical details

### New edge function: `admin-metrics`
Single function returning an aggregated JSON payload so the dashboard makes one round-trip:
- Verifies caller via `is_admin` RPC (rejects 403 otherwise).
- Returns: user counts, DAU/WAU/MAU, memories totals, push sub count, per-user storage list (paginated), subscription state counts.
- Uses service role; never exposes per-user PII beyond display_name + email prefix.

### New edge function: `admin-stripe-metrics`
- Admin-gated. Lists active subscriptions from Stripe, computes MRR, churn, new/cancelled counts.
- Cached client-side for 5 min via React Query-style state (simple `useState` + timestamp; project doesn't use react-query for these).

### Storage usage
- `supabase.storage.from('memories').list(userId, { limit: 1000 })` per user inside the `admin-metrics` function, summing `metadata.size`. For users with >1000 objects, paginate. Skip users with no memories.

### No schema changes required
All metrics can be derived from existing tables (`profiles`, `memories`, `subscriptions`, `push_subscriptions`, `push_send_events`, `broadcast_log`, `reminder_run_log`, `engagement_run_log`) plus Stripe. No migrations needed for v1.

### Files
- **New:** `src/pages/Admin.tsx`, `src/components/admin/AdminGuard.tsx`, `src/components/admin/OverviewTab.tsx`, `UsersTab.tsx`, `PushTab.tsx` (re-exports existing `AdminPanel`), `RevenueTab.tsx`, `ToolsTab.tsx`, `StatCard.tsx`
- **New edge functions:** `supabase/functions/admin-metrics/index.ts`, `supabase/functions/admin-stripe-metrics/index.ts`
- **Edited:** `src/pages/Profile.tsx` (strip admin sections, add single "Admin dashboard" link for admins), `src/App.tsx` (route)

## Out of scope (v1)
- Cohort retention curves
- Per-country breakdowns
- Real-time websocket updates
- Editing/refunding subscriptions from the dashboard (use Stripe portal)

## Open question
Any specific metric you want front-and-centre on the Overview tab for investor screenshots (e.g. WAU, MRR, or memories captured)? I can make that one the hero card.

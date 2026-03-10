Design system, architecture constraints, and key decisions for Okiro

## Design
- App name: **Okiro**
- Logo: `src/assets/okiro-logo.png` (pink flower)
- Fonts: Playfair Display (display), Source Sans 3 (body)
- Mobile-first, max-w-md centered layout

## Stripe
- Product: `prod_U7dvLVlxpD5r8N`
- Price: `price_1T9OdhJZind3K83s4UfCsPtL` — 7 NOK/week recurring
- **No Stripe trial** — free trial is app-side (7 days from first signup via `trial_usage` table)
- Full paywall after trial expires: non-subscribers see `/subscribe` page

## Auth
- Email/password + Google OAuth
- Subscription state tracked in AuthContext via `check-subscription` edge function
- `trialDaysLeft` exposed in auth context

## Subscription enforcement
- Server-side: `subscriptions` table + `has_active_subscription()` function used in RLS
- `trial_usage` table tracks email + first_signup_at to prevent trial abuse (re-signup)
- `check-subscription` edge function upserts into `subscriptions` table on every check
- RLS on `memories` requires active subscription (not just auth)

## Memories
- Editable: users can swap image and edit note on existing memories
- One photo per day constraint (upsert on user_id+date)
- Storage bucket is private; signed URLs used for access

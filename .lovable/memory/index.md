# Memory: index.md
Updated: now

## Okiro Project Memory

### Design
- App name: **Okiro**
- Logo: `src/assets/okiro-logo.png` (pink flower)
- Fonts: Playfair Display (display), Source Sans 3 (body)
- Mobile-first, max-w-md centered layout

### Stripe
- Product: `prod_U7dvLVlxpD5r8N`
- Price: `price_1T9OdhJZind3K83s4UfCsPtL` — 7 NOK/week recurring
- **No Stripe trial** — free trial is app-side (7 days from account creation)
- Full paywall after trial expires: non-subscribers see `/subscribe` page

### Auth
- Email/password + Google OAuth
- Subscription state tracked in AuthContext via `check-subscription` edge function
- `trialDaysLeft` exposed in auth context

### Memories
- Editable: users can swap image and edit note on existing memories
- One photo per day constraint (upsert on user_id+date)

# Switch from 7 NOK/week to 28 NOK/month

## Goal
- New checkouts use the monthly price `price_1TevL9JZind3K83svagyji0k` (28 NOK / month).
- All copy that says "7 NOK/week" updates to "28 NOK/month".
- Existing active weekly subscribers are migrated to the monthly price with Stripe handling proration.

## 1. Update checkout (price ID)
**`supabase/functions/create-checkout/index.ts`** — line 62: replace `price: "price_1T9OdhJZind3K83s4UfCsPtL"` with `price: "price_1TevL9JZind3K83svagyji0k"`.

## 2. Update UI copy (5 spots)
| File | Change |
|---|---|
| `src/pages/Landing.tsx` | "Then 7 NOK/week" → "Then 28 NOK/month" |
| `src/pages/Subscribe.tsx` | `7 NOK` / `/week` headline → `28 NOK` / `/month` |
| `src/pages/Profile.tsx` (×3) | trial-end note, active-sub line, and "Subscribe — 7 NOK/week" button all change to monthly |
| `src/pages/legal/Terms.tsx` | "7 NOK / week" → "28 NOK / month" |

No other code references the price.

## 3. Migrate existing weekly subscribers
New admin-only edge function **`supabase/functions/migrate-subscriptions/index.ts`**:
- Verifies caller via `is_admin` RPC (same pattern as `admin-metrics`).
- Lists all `status: "active"` subscriptions in Stripe.
- For each subscription whose first item is on the old weekly price (`price_1T9OdhJZind3K83s4UfCsPtL`), calls `stripe.subscriptions.update(sub.id, { items: [{ id: itemId, price: NEW_PRICE_ID }], proration_behavior: "create_prorations" })`.
- Returns `{ migrated, skipped, failed, details }` so we can see what happened.

Then add a button in the **Admin → Tools tab** (`src/pages/Admin.tsx`):
- "Migrate all weekly subs to monthly" → dry-run preview first (`{ preview: true }` returns counts without mutating), then a confirm dialog requiring "MIGRATE", then real run.
- Shows results inline after completion.

Stripe behaviour: customers stay on their current billing cycle until that cycle ends, then Stripe credits the unused weekly time and charges the new monthly amount on next renewal. No immediate charge unless the user wants `proration_behavior: "always_invoice"` (I'll default to `create_prorations`, which is the safer/standard choice).

## Out of scope
- Refunding currently-paid weekly periods (Stripe's proration credit covers this).
- Email notifications to users about the price change — say the word if you want one.

## Open question
After migration, do you want to **archive** the old weekly price in Stripe so nothing can accidentally check out at it? If yes, I'll add that as the last step in the migration function.

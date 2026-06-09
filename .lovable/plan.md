## Goal

Send a one-time, neutral billing-change notice to everyone with a Stripe customer record so they know the new standard is 28 NOK/month. Active weekly subs are being migrated (proration applies on next renewal); new and existing monthly subs see no change in what they pay. Trialing users are unaffected until conversion.

The email is admin-triggered from the Admin → Tools tab, not automatic.

## What the user sees

Subject: "An update to your Okiro billing"

Body (plain, no promo content):
- Short greeting.
- "Okiro's standard price is now 28 NOK per month (previously 7 NOK per week)."
- "If you're currently on the weekly plan, we've moved you to monthly. Your next renewal date stays the same — on that date you'll be charged 28 NOK instead of 7 NOK, with a small proration adjustment for any unused time. After that, you'll be billed monthly."
- "If you're already on the monthly plan or still in your free trial, nothing changes for you."
- "Questions or want to cancel? Manage your subscription from your Profile."
- Standard CAN-SPAM footer + unsubscribe (auto-appended by infra).

No CTA button required, but include a small "Manage subscription" link to `/profile`.

## Audience

Everyone with a Stripe customer that has either:
- an `active` subscription (any price), or
- a `trialing` subscription.

We exclude `canceled`/`incomplete_expired` so we don't email churned users out of the blue. Trialing users get a heads-up so the price they'll be charged at trial-end is not a surprise (this matters legally too — they signed up expecting 7 NOK/week).

Dedupe by email address (one email per person even if they somehow have two subs).

## Pieces to build

### 1. Email template
New React Email template at `supabase/functions/_shared/transactional-email-templates/billing-change-notice.tsx`, styled to match existing Okiro templates. Register it in `_shared/transactional-email-templates/registry.ts` as `billing-change-notice`. No per-recipient dynamic data beyond optional `displayName`.

### 2. Admin edge function
New function `supabase/functions/notify-billing-change/index.ts`:
- Verifies caller via `is_admin` RPC (same pattern as `migrate-subscriptions`).
- Accepts `{ dryRun: boolean }`.
- Lists Stripe subscriptions where `status in (active, trialing)`, paginates.
- Collects unique customer emails.
- In `dryRun: true` mode: returns `{ recipientCount, sampleEmails: first 5 }` and sends nothing.
- In `dryRun: false` mode: for each recipient, invokes `send-transactional-email` with:
  - `templateName: 'billing-change-notice'`
  - `recipientEmail: <email>`
  - `idempotencyKey: 'billing-change-2026-06-v1-<sha256(email)>'` so re-runs don't double-send.
  - `templateData: { displayName }` if we have it.
- Returns `{ attempted, enqueued, failed, failures }`.

### 3. Admin UI
Add a third card in the Admin → Tools tab in `src/pages/Admin.tsx`, next to "Migrate weekly → monthly":
- Title: "Notify subscribers of new monthly pricing"
- Subtext explaining what it sends and to whom.
- "Preview recipients" button → calls dry run → shows count + sample.
- "Send notification" button → opens AlertDialog requiring typing `SEND` → calls real run → shows result inline.

## Order of operations (manual)

1. Run the **migrate weekly → monthly** action first.
2. Then run the **send notification** action so the email accurately reflects the new state. If we send first, weekly users would read the email before their plan technically changed, which is fine but slightly more confusing.

The plan does not automate this ordering — it's just a note in the UI helper text.

## Non-goals

- No scheduled/automatic send. Admin-triggered only.
- No segmentation beyond active/trialing. Everyone gets the same copy.
- No retry UI beyond the queue's built-in retry — failures appear in `email_send_log`.
- No marketing content (per platform rules and good sense).

## Open question

Should trialing users also get this email, or only currently-paying ones? My recommendation is **yes, include trialing** — they're about to be charged at the new price and deserve notice. Confirm or override before I build.

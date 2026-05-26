## Goal

Make Okiro reasonably compliant with consumer-protection rules (FTC Act, GDPR, CCPA/CPRA, Apple/Google store policies) by adding the standard legal pages every app needs, and link them from the bottom of the sign-up screen.

## What to build

### 1. Three new static legal pages

Create plain, readable Markdown-style pages under `src/pages/legal/`:

- **`/privacy` — Privacy Policy**
  Covers: data we collect (email, name, photos, notes, device/push tokens, Stripe customer ID, basic analytics), why we collect it, legal basis (GDPR Art. 6), client-side encryption of photos, third-party processors (Lovable Cloud/Supabase, Stripe, push providers), data retention, international transfers, user rights (access, rectification, deletion, portability, objection), how to exercise them (Profile → Delete account, or email contact), children's policy (13+/16+ EEA), contact email, last-updated date.

- **`/terms` — Terms of Service**
  Covers: eligibility, account responsibility, acceptable use (no illegal/abusive content), subscription terms (7-day free trial, 7 NOK/week, auto-renew, cancel anytime via customer portal), refund policy, IP ownership (user owns their photos, grants Okiro a limited license to store/display them back to them), disclaimers, limitation of liability, governing law, changes to terms, contact.

- **`/cookies` — Cookie & Storage Policy**
  Covers: what we store in localStorage (auth session, React Query cache, install prompt state), no third-party advertising cookies, Stripe checkout cookies, how to clear.

Each page: simple centered max-w-2xl layout, uses existing design tokens, back link to previous page, "Last updated: May 2026".

### 2. Routes

Add three lazy routes in `src/App.tsx` as public (no auth required):
`/privacy`, `/terms`, `/cookies`.

### 3. Sign-up screen compliance block

In `src/pages/Auth.tsx`, below the form:

- **Consent microcopy** above the submit button (only in signup mode):
  "By creating an account, you agree to our [Terms](/terms) and [Privacy Policy](/privacy)."
  This is the FTC-recommended clear-and-conspicuous disclosure pattern; no pre-ticked boxes.

- **Footer links row** at the bottom of the screen (both modes):
  `Privacy · Terms · Cookies · Contact`

### 4. Landing page footer

Add the same legal links to the existing `/welcome` landing footer so they're reachable from the marketing page too (required by app stores when they review the listing).

### 5. Profile screen — data rights surface

In `src/pages/Profile.tsx`, add a small "Your data" section with:
- Link to Privacy Policy
- "Download my data" note (link to mailto contact for now — full export can come later)
- The existing Delete account button stays (this satisfies GDPR right-to-erasure and CCPA right-to-delete).

### 6. Contact email

Use a single contact address everywhere (e.g. `hello@okiro.online` or `privacy@okiro.online`). Need you to confirm which.

## What we are NOT adding (and why)

- **ISO 27001 / SOC 2 / "safety certificate" badges** — these are real audit certifications that cost tens of thousands of dollars and require months of process work. Displaying a badge without the underlying audit is itself an FTC deceptive-practices violation. Skip until/unless you actually pursue certification.
- **GDPR "EU Representative" badge** — only required if you have no EU establishment and target EU users at scale; can be added later via a service like Prighter if needed.
- **Cookie consent banner** — Okiro uses only strictly-necessary storage (auth, app state) and Stripe checkout. No advertising/analytics cookies are set today, so a banner is not required under ePrivacy. If Google Analytics, Meta Pixel, etc. are added later, a CMP (e.g. Cookiebot) becomes mandatory.
- **Age gate** — Terms state 13+ (16+ in EEA). A hard age-gate screen is only required for child-directed apps.

## Open questions (one quick answer needed)

1. Contact email to use on legal pages: `hello@okiro.online`, `privacy@okiro.online`, or something else?
2. Legal entity & country for "governing law" clause in Terms — is this a Norwegian sole proprietorship / company, or personal? (Just need a country; "Norway" is fine if unincorporated.)

I can use sensible defaults (`hello@okiro.online`, Norway) if you'd rather I just proceed.

## Files touched

- new: `src/pages/legal/Privacy.tsx`, `src/pages/legal/Terms.tsx`, `src/pages/legal/Cookies.tsx`
- edit: `src/App.tsx` (routes), `src/pages/Auth.tsx` (consent + footer), `src/pages/Landing.tsx` (footer links), `src/pages/Profile.tsx` (data rights section)

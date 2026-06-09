# Pre-Launch Fixes — Plan

Covers audit items B2, H6, B3, B4, H4. No destructive changes; all existing flows continue working. Where a flow must change (signup, OAuth, email footers), it is rewritten end-to-end.

---

## 1. Age gate + OAuth consent (B2 + H6)

**Goal:** No account can be created without (a) confirming ≥16 (EEA-safe default, also clears COPPA) and (b) accepting Terms + Privacy. Applies equally to email signup, Google, and Apple.

### 1a. New shared consent component

`src/components/auth/ConsentGate.tsx` (new) — small, reusable:

- Checkbox 1: "I confirm I am at least 16 years old."
- Checkbox 2: "I agree to the Terms and Privacy Policy." (links to `/terms`, `/privacy`)
- Exposes `{ accepted: boolean }` + an `onContinue` callback only enabled when both are true.
- Persists acceptance to `localStorage` (`okiro.consent.v1 = { age16: true, tos: true, at: ISO }`) so we can later prove consent timestamp.

### 1b. `src/pages/Auth.tsx` rewrite (mode-aware)

- **Login mode:** unchanged (no gate needed for existing users).
- **Signup mode:** render `<ConsentGate />` above the email form. Email submit button stays disabled until both boxes ticked.
- **OAuth buttons (Google + Apple):** two-step:
  1. If signup intent (toggle `mode === "signup"`) and consent NOT recorded → clicking Google/Apple opens an inline confirm sheet (Radix `Dialog`) showing the same two checkboxes. Only after both are ticked and "Continue with Google/Apple" is pressed do we call `lovable.auth.signInWithOAuth(...)`.
  2. If user is in login mode, OAuth proceeds immediately (provider itself handles account creation; we still record consent on first successful session — see 1c).
- Add a hidden "signup intent" flag persisted in `sessionStorage` before redirect so we know on return whether to enforce gate.

### 1c. Post-OAuth backstop

In `src/hooks/useAuth.tsx` `onAuthStateChange` SIGNED_IN handler:

- If `localStorage.okiro.consent.v1` missing AND `profiles.consent_accepted_at` is null → route the user to `/welcome/consent` (new minimal page) that forces the two checkboxes before they can reach `/`.
- On confirm, write to localStorage + call new edge function `record-consent` (service-role) that stamps `profiles.consent_accepted_at`, `consent_age_confirmed`, `consent_tos_version`.

### 1d. Database

Migration adds 3 columns to `public.profiles`:

- `consent_accepted_at timestamptz`
- `consent_age_confirmed boolean default false`
- `consent_tos_version text` (e.g. `"2026-06-09"`)

No RLS change (existing owner-only policy already covers it). Backfill existing rows with `consent_accepted_at = created_at`, `consent_age_confirmed = true` (grandfathered) so current users aren't blocked.

### 1e. New tiny edge function `record-consent`

Verifies JWT, writes the three columns for `auth.uid()`. No public exposure beyond authenticated users.

---

## 2. DMCA / abuse contact + report flow on memories (B3)

Memories are private (owner-only RLS) so abuse risk is mostly: (a) legal contact missing from Terms/Privacy, (b) no in-app channel if a user is coerced to host illegal content, (c) no DMCA address for rights-holders. We address all three without adding social features.

### 2a. Legal pages

- `**src/pages/legal/Terms.tsx**` — add section "12. Reporting illegal or infringing content" with:
  - Abuse contact: `abuse@okiro.online` (alias to `hello@okiro.online`, configured at registrar — user-action note included).
  - DMCA designated agent block (name, postal address from §3 below, email, statement that we respond within 10 business days).
  - Right of users to report their own account being misused.
- `**src/pages/legal/Privacy.tsx**` — add same abuse contact under §10 "Contact".

### 2b. In-app report/delete flow on `MemoryCard`

Add a third action to the existing Popover (next to Share + Edit):

- "Report or remove" → opens a Radix `Dialog`:
  - Radio: `It's my content and I want it deleted` | `It violates someone else's rights (DMCA)` | `Other concern`
  - Optional textarea (max 500 chars, validated with zod).
  - Submit:
    - For "delete my content" → calls existing `deleteMemory` then closes.
    - For DMCA/other → invokes new edge function `submit-abuse-report` which sends an app email (via existing `send-transactional-email`) to `abuse@okiro.online` with the memory id, user id, category, message, timestamp, and writes a row to a new `abuse_reports` table.

### 2c. Database

Migration creates `public.abuse_reports`:

- `id uuid pk`, `reporter_user_id uuid`, `memory_id uuid null`, `category text check in (...)`, `message text`, `status text default 'open'`, `created_at`, `updated_at`.
- `GRANT` block: `INSERT, SELECT` for `authenticated` (own rows), `ALL` for `service_role`.
- RLS: insert if `auth.uid() = reporter_user_id`; select own rows; admin (`is_admin`) can select all; update only by admin.

### 2d. New template

`supabase/functions/_shared/transactional-email-templates/abuse-report.tsx` registered in `registry.ts` as `abuse-report` (recipient: `abuse@okiro.online`).

### 2e. New edge function `submit-abuse-report`

JWT-verified. Zod-validates payload. Rate-limits to 5 reports / hour / user (in-memory map). Inserts row, invokes `send-transactional-email`.

---

## 3. Unsubscribe link + physical postal address in every email (B4 + H4)

**Goal:** CAN-SPAM compliance — every outbound email (transactional + auth) must contain a visible postal address. Marketing-class emails must additionally show a working unsubscribe link.

### 3a. Shared footer component

`supabase/functions/_shared/transactional-email-templates/footer.tsx` (new):

- Props: `{ unsubscribeUrl?: string }`
- Renders:
  - Postal address block (configurable constants below)
  - "You're receiving this because you have an Okiro account." (transactional) OR "Don't want these? [Unsubscribe]" (marketing)
  - Link to Privacy + Terms

**Postal address constants** (single source — `_shared/brand.ts`):

```
COMPANY_LEGAL_NAME = "Okiro"
COMPANY_POSTAL = "[street], [postcode] [city], Norway"
```

We will leave placeholder tokens and the implementation will halt with a question to the user for the actual address before deploy. (Question listed in the open-items section below.)

### 3b. Apply footer to every template

- All 6 auth templates in `_shared/email-templates/` → import + render `<Footer />` (no unsubscribe link; auth emails are exempt from opt-out but still need postal address under CAN-SPAM).
- `welcome.tsx` (transactional) → render `<Footer unsubscribeUrl={...} />` (welcome is a borderline marketing greeting → include unsubscribe).
- Future templates documented in `registry.ts` comment that footer is mandatory.

### 3c. Unsubscribe URL generation

`send-transactional-email` already issues one-click tokens via `email_unsubscribe_tokens`. Extend it to:

- Always generate (or reuse) a token per recipient.
- Pass `unsubscribeUrl = https://okiro.online/unsubscribe?token=...` as templateData so the footer renders it.
- Add `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (Gmail/Yahoo Feb-2024 requirement).

### 3d. Auth emails postal-address backstop

`auth-email-hook/index.ts` already pre-renders HTML. Templates updated in 3b automatically pick up the new footer — no hook change needed beyond redeploy.

### 3e. Deploy

After edits, deploy: `auth-email-hook`, `send-transactional-email`, plus new `record-consent` and `submit-abuse-report`.

---

## Technical details

### Files created

- `src/components/auth/ConsentGate.tsx`
- `src/pages/WelcomeConsent.tsx` (route `/welcome/consent`)
- `supabase/functions/record-consent/index.ts`
- `supabase/functions/submit-abuse-report/index.ts`
- `supabase/functions/_shared/transactional-email-templates/footer.tsx`
- `supabase/functions/_shared/transactional-email-templates/abuse-report.tsx`
- `supabase/functions/_shared/brand.ts`
- 1 migration: `profiles` consent columns + backfill, `abuse_reports` table + GRANTs + RLS

### Files edited

- `src/pages/Auth.tsx` (consent gate + OAuth confirm sheet)
- `src/hooks/useAuth.tsx` (post-OAuth consent backstop)
- `src/App.tsx` (add `/welcome/consent` route)
- `src/components/MemoryCard.tsx` (Report action + dialog)
- `src/pages/legal/Terms.tsx` (DMCA section)
- `src/pages/legal/Privacy.tsx` (abuse contact)
- 6 auth templates in `_shared/email-templates/*.tsx` (footer)
- `_shared/transactional-email-templates/welcome.tsx` (footer)
- `_shared/transactional-email-templates/registry.ts` (register abuse-report)
- `supabase/functions/send-transactional-email/index.ts` (token + footer URL + List-Unsubscribe headers)

### Verification (after build mode)

- Sign up via email → cannot submit until both checkboxes ticked.
- Sign up via Google/Apple → confirm sheet appears, consent recorded post-redirect.
- Existing users: `profiles` backfill = no interruption.
- Report a memory → row in `abuse_reports`, email lands in `abuse@okiro.online` inbox via process-email-queue.
- `curl` a rendered auth email preview → footer with postal address visible; welcome email also shows unsubscribe link.
- `process-email-queue` payload includes `List-Unsubscribe` headers.

---

## Open items needing your input before build

1. **Postal address** — what legal company name + Norwegian street address should appear in email footers and the DMCA notice? (Required for CAN-SPAM + DMCA designated-agent text.) (Okiro is "owned"/made by my company Nordli Media. Adress is Carl Berners Plass 2, Oslo, Norway.
2. **Abuse email alias** — OK to use `abuse@okiro.online` (alias → `hello@okiro.online`)? Or a different inbox? Can we just stickk with hello@okiro.0nline?
3. **OAuth consent UX** — preferred flow: (a) inline confirm sheet before redirect (recommended, in plan), or (b) full `/welcome/consent` step only after redirect, no pre-confirm? IStick to plan

Once you answer 1–3 I'll implement.
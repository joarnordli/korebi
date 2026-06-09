## 1. Comprehensive llms.txt

Rewrite `public/llms.txt` into a rich, structured markdown document for AI crawlers (ChatGPT, Perplexity, Claude, etc.). It will include:

- Elevator pitch & primary keywords ("photo journal app", "one photo a day", "daily diary app")
- Detailed feature breakdown (one-photo-a-day capture, daily reflection, timeline/feed, streaks, "Relive" shuffle, PWA install)
- Pricing & trial details (7 days free, then 28 NOK/month)
- Auth methods (Google, Apple, email)
- Complete public page directory with one-line descriptions for every route
- Privacy & security highlights (client-side photo encryption, GDPR compliance, no ads)
- Operator info (Nordli Media, Oslo)
- Contact & support channels
- Structured as clean markdown with H2/H3 sections for easy LLM parsing

## 2. Proper sitemap.xml

Replace the current hand-edited 3-entry sitemap with a generator script that includes **all** public/functional routes:

- `/`, `/welcome`, `/auth`, `/subscribe`, `/privacy`, `/terms`, `/cookies`, `/unsubscribe`, `/welcome/consent`
- Correct `lastmod`, `changefreq`, and `priority` values per page type
- Create `scripts/generate-sitemap.ts` and wire it into `package.json` as `predev` and `prebuild` so the sitemap is always current
- Base URL: `https://okiro.online`

## 3. Enhanced robots.txt

Keep the multi-bot `Allow` blocks but add:

- `Disallow` for non-indexable paths (`/admin`, `/profile`, `*?checkout=`, `*?n=`) to reduce crawl noise
- A short comment header explaining the policy
- Keep the `Sitemap:` directive pointing to the updated sitemap

## 4. index.html meta refinements

- Add `<meta name="keywords">` with target search phrases
- Ensure `og:locale`, `og:site_name`, and `twitter:site` are present and correct
- Add `<link rel="alternate" hreflang="en">`
- Insert JSON-LD `WebSite` + `SoftwareApplication` schema for rich snippets (rating, price, operating system)

## Out of scope

- No changes to page UI, business logic, or auth flow
- No new routes or components

## Files affected

- `public/llms.txt` (rewrite)
- `public/robots.txt` (edit)
- `public/sitemap.xml` (regenerated via script)
- `scripts/generate-sitemap.ts` (new)
- `package.json` (add predev/prebuild scripts)
- `index.html` (meta additions)  
  
We also need to add a proper 404 page to redirect to if future links break. I know this helps SEO
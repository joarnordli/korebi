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
- 7-day free trial on checkout
- Full paywall: non-subscribers see `/subscribe` page

### Auth
- Email/password + Google OAuth
- Subscription state tracked in AuthContext via `check-subscription` edge function

### Memories
- Editable: users can swap image and edit note on existing memories
- One photo per day constraint (upsert on user_id+date)

### Image Encryption (Admin-Friction Obfuscation)
- Images encrypted client-side with AES-256-GCM before upload
- Key derived from `PBKDF2(userId + ENCRYPTION_SALT)` — zero user friction
- `ENCRYPTION_SALT` stored as backend secret, served via `get-encryption-salt` edge function
- `encryption_iv` column on `memories` table stores per-image IV (nullable for backward compat)
- Encrypted blobs uploaded as `application/octet-stream` — admins see garbage in storage
- Decryption happens client-side on feed load via Web Crypto API
- Existing unencrypted images continue to work (no `encryption_iv` = direct URL)

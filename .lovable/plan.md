

# Client-Side Image Obfuscation (Admin-Friction Encryption)

## The Tradeoff You've Identified

You're right that a master password, security phrase, or device-stored key all add user friction and hurt conversion. But you also don't need military-grade zero-knowledge encryption — you need a **friction layer for admins** that prevents casually viewing user images in the storage bucket.

## Why User ID Alone Is Weak

The user ID (UUID) is stored in plaintext in the `memories` table, the `profiles` table, and throughout the database. An admin browsing the database already sees user IDs everywhere. If the encryption key is just the user ID, any admin who understands the scheme can trivially decrypt — it's security through obscurity with a well-known secret.

## Recommended Approach: User ID + Server-Side Salt

A better version of your idea: derive the encryption key from `userId + a secret salt` stored only as a backend secret (environment variable). This means:

- **Users**: Zero friction. No passwords, no extra steps. The app derives the key automatically using their auth session + the salt fetched from a backend function.
- **Admins browsing storage**: See encrypted binary blobs, not images. Can't view them in the storage UI.
- **Admins who try harder**: Would need to (1) know the encryption scheme, (2) find the salt secret, (3) write custom decryption code. That's meaningful friction.
- **Not zero-knowledge**: A determined admin with service_role access could theoretically decrypt. But it prevents accidental exposure, which is your stated goal.

```text
Encrypt:  key = PBKDF2(userId + SERVER_SALT) → AES-GCM encrypt image blob
Upload:   encrypted blob → storage bucket (application/octet-stream)
Decrypt:  fetch blob → derive same key → AES-GCM decrypt → display via objectURL
```

## Implementation Plan

### 1. Backend function to provide salt (`supabase/functions/get-encryption-salt/index.ts`)
- Returns the `ENCRYPTION_SALT` secret to authenticated users only
- The salt is stored as a backend secret (not in client code)
- Client caches it in memory for the session

### 2. New file: `src/lib/crypto.ts`
- `deriveKey(userId, salt)` — PBKDF2 with 100k iterations → AES-256-GCM key
- `encryptBlob(blob, key)` — encrypt image, return `{ encrypted: ArrayBuffer, iv: Uint8Array }`
- `decryptBlob(encrypted, iv, key)` — decrypt back to blob

### 3. Database migration
- Add `encryption_iv` (text, nullable) column to `memories` table
- Nullable so existing unencrypted images continue to work seamlessly

### 4. Update `src/lib/memories.ts`
- **`saveMemory`**: after compression, derive key → encrypt blob → upload encrypted binary with `contentType: "application/octet-stream"` → store base64 IV in the `encryption_iv` column
- **`getMemories`**: check if `encryption_iv` exists on each memory; if yes, fetch raw blob via signed URL, decrypt client-side, create `objectURL`; if no, use signed URL directly (backward compatible)
- Update validation to also allow `application/octet-stream` for encrypted uploads

### 5. Update `src/components/MemoryCard.tsx`
- Display images via object URLs from decrypted blobs (for encrypted memories)
- Revoke object URLs on unmount to prevent memory leaks

### 6. Add `ENCRYPTION_SALT` secret
- Use the secrets tool to store a random salt value as a backend secret

## What This Changes for Users
Nothing. Zero UX change. Same capture flow, same feed, same editing. The encryption/decryption is entirely transparent.

## What This Changes for Admins
- Storage bucket shows `.webp` files that are actually encrypted binary — opening them shows garbage
- Database `image_url` column still shows paths, but the files behind those paths are unreadable without the salt + decryption code

## Limitations
- **Not zero-knowledge** — an admin with access to the `ENCRYPTION_SALT` secret and knowledge of the scheme can decrypt
- **Metadata remains unencrypted** — dates, notes, GPS coordinates are still plaintext in the database
- **Existing images** stay unencrypted (a migration script could re-encrypt them later as a follow-up)
- **Slightly slower feed load** — each image needs an `ArrayBuffer` fetch + ~10-30ms decryption (negligible for compressed WebP files)


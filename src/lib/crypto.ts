/**
 * Client-side image obfuscation using Web Crypto API.
 * Derives an AES-256-GCM key from userId + server salt via PBKDF2.
 * Encrypts image blobs before upload so admins can't casually view them.
 */

import { supabase } from "@/integrations/supabase/client";

let cachedSalt: string | null = null;

/** Fetch the server-side encryption salt (cached per session) */
export async function getEncryptionSalt(): Promise<string> {
  if (cachedSalt) return cachedSalt;

  const { data, error } = await supabase.functions.invoke("get-encryption-salt");
  if (error || !data?.salt) {
    throw new Error("Failed to retrieve encryption salt");
  }
  cachedSalt = data.salt;
  return cachedSalt!;
}

/** Derive an AES-256-GCM key from userId + salt using PBKDF2 */
export async function deriveKey(userId: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(userId + salt),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a blob with AES-256-GCM. Returns encrypted ArrayBuffer + IV. */
export async function encryptBlob(
  blob: Blob,
  key: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = await blob.arrayBuffer();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return { encrypted, iv };
}

/** Decrypt an AES-256-GCM encrypted ArrayBuffer back to a Blob. */
export async function decryptBlob(
  encrypted: ArrayBuffer,
  iv: Uint8Array,
  key: CryptoKey,
  mimeType = "image/webp"
): Promise<Blob> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );

  return new Blob([decrypted], { type: mimeType });
}

/** Convert a Uint8Array to base64 string for storage */
export function ivToBase64(iv: Uint8Array): string {
  return btoa(String.fromCharCode(...iv));
}

/** Convert a base64 string back to Uint8Array */
export function base64ToIv(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

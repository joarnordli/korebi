import { supabase } from "@/integrations/supabase/client";
import { extractGpsFromFile } from "@/lib/exif";
import {
  getEncryptionSalt,
  deriveKey,
  encryptBlob,
  decryptBlob,
  ivToBase64,
  base64ToIv,
} from "@/lib/crypto";

export interface Memory {
  id: string;
  date: string;
  image_url: string;
  note: string | null;
  created_at: string;
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  encryption_iv: string | null;
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const MAGIC_BYTES: { bytes: number[]; offset?: number; type: string }[] = [
  { bytes: [0xff, 0xd8, 0xff], type: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], type: "image/png" },
  { bytes: [0x47, 0x49, 0x46, 0x38], type: "image/gif" },
  // WebP: starts with RIFF....WEBP
  { bytes: [0x52, 0x49, 0x46, 0x46], type: "image/webp" },
];

/**
 * Validates an image file by checking MIME type, magic bytes, and size.
 * Returns the safe file extension derived from magic bytes.
 */
async function validateImageFile(file: File): Promise<string> {
  // 1. Size check
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 10 MB.");
  }

  // 2. MIME type check
  if (!ALLOWED_TYPES[file.type]) {
    throw new Error("Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.");
  }

  // 3. Magic bytes check
  const header = await file.slice(0, 12).arrayBuffer();
  const arr = new Uint8Array(header);

  let detectedType: string | null = null;
  for (const sig of MAGIC_BYTES) {
    const offset = sig.offset ?? 0;
    if (sig.bytes.every((b, i) => arr[offset + i] === b)) {
      // For WebP, also verify bytes 8-11 are "WEBP"
      if (sig.type === "image/webp") {
        if (arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) {
          detectedType = sig.type;
        }
      } else {
        detectedType = sig.type;
      }
      break;
    }
  }

  if (!detectedType) {
    throw new Error("File content does not match a supported image format.");
  }

  return ALLOWED_TYPES[detectedType];
}

// In-memory signed URL cache: path -> { url, expiresAt }
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_TTL = 86400; // 24 hours

/** Extract storage path from a full URL or return as-is if already a path */
function extractStoragePath(imageUrl: string): string {
  if (!imageUrl.startsWith("http")) return imageUrl;
  const match = imageUrl.match(/\/object\/(?:public|sign)\/memories\/(.+?)(?:\?.*)?$/);
  if (match) return match[1];
  const fallback = imageUrl.match(/\/memories\/(.+?)(?:\?.*)?$/);
  if (fallback) return fallback[1];
  return imageUrl;
}

async function batchSignUrls(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const result = new Map<string, string>();
  const uncached: string[] = [];

  for (const p of paths) {
    const cached = signedUrlCache.get(p);
    if (cached && cached.expiresAt > now + 60_000) {
      result.set(p, cached.url);
    } else {
      uncached.push(p);
    }
  }

  if (uncached.length > 0) {
    const { data, error } = await supabase.storage
      .from("memories")
      .createSignedUrls(uncached, SIGNED_URL_TTL);

    if (!error && data) {
      for (const item of data) {
        if (item.signedUrl && item.path) {
          signedUrlCache.set(item.path, {
            url: item.signedUrl,
            expiresAt: now + SIGNED_URL_TTL * 1000,
          });
          result.set(item.path, item.signedUrl);
        }
      }
    }
  }

  // Fallback for any paths that didn't get signed
  for (const p of paths) {
    if (!result.has(p)) result.set(p, p);
  }

  return result;
}

export async function getMemories(): Promise<Memory[]> {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  const memories = (data ?? []) as Memory[];
  if (memories.length === 0) return [];

  const paths = memories.map((m) => extractStoragePath(m.image_url));
  const urlMap = await batchSignUrls(paths);

  // Identify encrypted memories and decrypt them in parallel
  const encryptedMemories = memories.filter((m) => m.encryption_iv);

  let cryptoKey: CryptoKey | null = null;
  if (encryptedMemories.length > 0) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const salt = await getEncryptionSalt();
      cryptoKey = await deriveKey(userData.user.id, salt);
    }
  }

  // Build final memory list with decrypted object URLs for encrypted images
  const decryptedUrls = new Map<string, string>();
  if (cryptoKey && encryptedMemories.length > 0) {
    await Promise.all(
      encryptedMemories.map(async (m) => {
        try {
          const path = extractStoragePath(m.image_url);
          const signedUrl = urlMap.get(path) || m.image_url;
          const response = await fetch(signedUrl);
          const encryptedBuffer = await response.arrayBuffer();
          const iv = base64ToIv(m.encryption_iv!);
          const blob = await decryptBlob(encryptedBuffer, iv, cryptoKey!);
          decryptedUrls.set(m.id, URL.createObjectURL(blob));
        } catch (err) {
          console.warn("Failed to decrypt memory", m.id, err);
        }
      })
    );
  }

  return memories.map((m) => {
    if (decryptedUrls.has(m.id)) {
      return { ...m, image_url: decryptedUrls.get(m.id)! };
    }
    const path = extractStoragePath(m.image_url);
    return { ...m, image_url: urlMap.get(path) || m.image_url };
  });
}

export async function saveMemory(
  userId: string,
  date: string,
  imageFile: File,
  note: string,
  gps?: { latitude: number; longitude: number } | null
): Promise<void> {
  const ext = await validateImageFile(imageFile);
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("memories")
    .upload(path, imageFile, { upsert: true, contentType: imageFile.type });
  if (uploadError) throw uploadError;

  // Use provided GPS coords (extracted before compression) or try EXIF as fallback
  const coords = gps ?? (await extractGpsFromFile(imageFile));

  const { error } = await supabase.from("memories").upsert(
    {
      user_id: userId,
      date,
      image_url: path,
      note: note.trim() || null,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    } as any,
    { onConflict: "user_id,date" }
  );
  if (error) throw error;
}

/**
 * Computes the current streak: consecutive days with a memory,
 * counting backward from today (or yesterday if no memory today).
 */
export function getStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  const today = getTodayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split("T")[0];

  let streak = 0;
  let expected = sorted[0] === today ? today : sorted[0] === yesterdayKey ? yesterdayKey : null;
  if (!expected) return 0;

  for (const d of sorted) {
    if (d === expected) {
      streak++;
      const prev = new Date(expected + "T12:00:00");
      prev.setDate(prev.getDate() - 1);
      expected = prev.toISOString().split("T")[0];
    } else if (d < expected!) {
      break;
    }
  }
  return streak;
}

export async function updateMemory(
  memoryId: string,
  userId: string,
  updates: { note?: string; imageFile?: File }
): Promise<void> {
  let image_url: string | undefined;

  if (updates.imageFile) {
    const ext = await validateImageFile(updates.imageFile);
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("memories")
      .upload(path, updates.imageFile, { upsert: true, contentType: updates.imageFile.type });
    if (uploadError) throw uploadError;
    image_url = path;
  }

  const updateData: Record<string, unknown> = {};
  if (updates.note !== undefined) updateData.note = updates.note.trim() || null;
  if (image_url) updateData.image_url = image_url;

  if (Object.keys(updateData).length === 0) return;

  const { error } = await supabase
    .from("memories")
    .update(updateData)
    .eq("id", memoryId);
  if (error) throw error;
}

export async function hasTodayMemory(): Promise<boolean> {
  const today = getTodayKey();
  const { count } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("date", today);
  return (count ?? 0) > 0;
}

export function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const todayKey = now.toISOString().split("T")[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split("T")[0];

  if (dateStr === todayKey) return "Today";
  if (dateStr === yesterdayKey) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

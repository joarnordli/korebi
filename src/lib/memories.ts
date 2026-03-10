import { supabase } from "@/integrations/supabase/client";

export interface Memory {
  id: string;
  date: string;
  image_url: string;
  note: string | null;
  created_at: string;
  user_id: string;
}

export async function getMemories(): Promise<Memory[]> {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveMemory(
  userId: string,
  date: string,
  imageFile: File,
  note: string
): Promise<void> {
  // Upload image
  const ext = imageFile.name.split(".").pop() || "jpg";
  const path = `${userId}/${date}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("memories")
    .upload(path, imageFile, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from("memories").getPublicUrl(path);

  // Upsert memory
  const { error } = await supabase.from("memories").upsert(
    {
      user_id: userId,
      date,
      image_url: urlData.publicUrl,
      note: note.trim() || null,
    },
    { onConflict: "user_id,date" }
  );
  if (error) throw error;
}

export async function updateMemory(
  memoryId: string,
  userId: string,
  updates: { note?: string; imageFile?: File }
): Promise<void> {
  let image_url: string | undefined;

  if (updates.imageFile) {
    const ext = updates.imageFile.name.split(".").pop() || "jpg";
    const path = `${userId}/${memoryId}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("memories")
      .upload(path, updates.imageFile, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from("memories").getPublicUrl(path);
    image_url = urlData.publicUrl;
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

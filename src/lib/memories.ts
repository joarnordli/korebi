export interface Memory {
  id: string;
  date: string; // YYYY-MM-DD
  imageData: string; // base64 data URL
  note: string;
  createdAt: number;
}

const STORAGE_KEY = "daily-memories";

export function getMemories(): Memory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMemory(memory: Memory): void {
  const memories = getMemories();
  const existing = memories.findIndex((m) => m.date === memory.date);
  if (existing >= 0) {
    memories[existing] = memory;
  } else {
    memories.unshift(memory);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

export function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function hasTodayMemory(): boolean {
  const today = getTodayKey();
  return getMemories().some((m) => m.date === today);
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

import { supabase } from "@/integrations/supabase/client";

const DISMISSED_KEY = "okiro:push_prompt_dismissed";
const DEFAULT_WINDOW_START = 6;
const DEFAULT_WINDOW_END = 12;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBuffersEqual(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a) return false;
  const av = new Uint8Array(a);
  if (av.length !== b.length) return false;
  for (let i = 0; i < av.length; i++) if (av[i] !== b[i]) return false;
  return true;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function isIOSWithoutStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return isIOS && !isStandalone;
}

export function pushDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPushDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch { /* ignore */ }
}

export function clearPushDismissed() {
  try {
    localStorage.removeItem(DISMISSED_KEY);
  } catch { /* ignore */ }
}

/**
 * Subscribe the device to push and upsert the row in push_subscriptions.
 * Assumes permission is already granted.
 */
async function subscribeAndStore(userId: string) {
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) =>
      setTimeout(() => reject(new Error("Service worker not ready")), 5000)
    ),
  ]);

  const { data: keyData, error: keyError } = await supabase.functions.invoke("get-vapid-key");
  if (keyError || !keyData?.publicKey) throw new Error("Could not fetch push key");
  const vapidKey = keyData.publicKey as string;
  const vapidKeyBytes = urlBase64ToUint8Array(vapidKey);

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const existingKey = existing.options?.applicationServerKey ?? null;
    if (!arrayBuffersEqual(existingKey, vapidKeyBytes)) {
      try { await existing.unsubscribe(); } catch { /* ignore */ }
      await supabase.from("push_subscriptions").delete().eq("endpoint", existing.endpoint);
    }
  }

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyBytes,
    }));

  const subJson = subscription.toJSON();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { error: upsertError } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subJson.endpoint!,
      p256dh: subJson.keys!.p256dh!,
      auth: subJson.keys!.auth!,
      timezone,
      reminder_enabled: true,
      reminder_window_start: DEFAULT_WINDOW_START,
      reminder_window_end: DEFAULT_WINDOW_END,
    },
    { onConflict: "user_id,endpoint" }
  );
  if (upsertError) throw upsertError;
}

export type EnablePushResult =
  | { status: "granted" }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "needs-install" }
  | { status: "error"; error: Error };

/**
 * Prompt the user (if permission is "default") and subscribe on grant.
 * Idempotent and safe to call multiple times.
 */
export async function enablePush(userId: string): Promise<EnablePushResult> {
  if (!pushSupported()) return { status: "unsupported" };
  if (isIOSWithoutStandalone()) return { status: "needs-install" };

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      markPushDismissed();
      return { status: "denied" };
    }
    await subscribeAndStore(userId);
    clearPushDismissed();
    return { status: "granted" };
  } catch (err: any) {
    return { status: "error", error: err instanceof Error ? err : new Error(String(err)) };
  }
}

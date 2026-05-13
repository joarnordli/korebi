// Okiro Push Notification Service Worker

const SUPABASE_URL = "https://evjpvgsmrojbnccgkoxv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2anB2Z3Ntcm9qYm5jY2drb3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTg1NzMsImV4cCI6MjA4ODYzNDU3M30.Uk2u1_Qa17ihUQt_jy65emN3-xq-0_W6X1TVfZuS7kU";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function fetchVapidPublicKey() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-vapid-key`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error("Failed to fetch VAPID key");
  const { publicKey } = await res.json();
  return publicKey;
}

// Re-subscribe transparently when the browser rotates the push endpoint.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const publicKey = await fetchVapidPublicKey();
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      } catch {
        // Best-effort; user will re-enable from the app
      }
    })()
  );
});

function trackOpen(eventId) {
  if (!eventId) return Promise.resolve();
  return fetch(`${SUPABASE_URL}/functions/v1/track-push-open`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ eventId }),
  }).catch(() => { /* best effort */ });
}

// ---- Badge count helpers (Cache-backed since localStorage isn't available in SW) ----
const BADGE_CACHE = "okiro-badge-v1";
const BADGE_KEY = "/__badge_count__";

async function readBadgeCount() {
  try {
    const cache = await caches.open(BADGE_CACHE);
    const res = await cache.match(BADGE_KEY);
    if (!res) return 0;
    const n = parseInt(await res.text(), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function writeBadgeCount(n) {
  try {
    const cache = await caches.open(BADGE_CACHE);
    await cache.put(BADGE_KEY, new Response(String(n)));
  } catch { /* ignore */ }
}

async function setBadge(n) {
  try {
    if (n > 0 && self.navigator && "setAppBadge" in self.navigator) {
      await self.navigator.setAppBadge(n);
    } else if (self.navigator && "clearAppBadge" in self.navigator) {
      await self.navigator.clearAppBadge();
    }
  } catch { /* ignore */ }
}

async function clearBadgeAndNotifications() {
  await writeBadgeCount(0);
  try {
    if (self.navigator && "clearAppBadge" in self.navigator) {
      await self.navigator.clearAppBadge();
    }
  } catch { /* ignore */ }
  try {
    const notes = await self.registration.getNotifications();
    notes.forEach((n) => n.close());
  } catch { /* ignore */ }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_BADGE") {
    event.waitUntil(clearBadgeAndNotifications());
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "Okiro", body: "Time to capture today's moment ✨" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/app-icon-512.png",
    badge: "/app-icon-512.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
      eventId: data.eventId || null,
    },
    actions: [
      { action: "capture", title: "Capture now" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";
  const eventId = event.notification.data?.eventId || null;

  event.waitUntil(
    Promise.all([
      trackOpen(eventId),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            // Try to navigate the focused client to the tracked URL so the app can
            // also pick up the ?n= fallback param.
            if ("navigate" in client) {
              try { client.navigate(url); } catch { /* ignore */ }
            }
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
    ])
  );
});

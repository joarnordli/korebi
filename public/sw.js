// Okiro Push Notification Service Worker

const VAPID_PUBLIC_KEY = "BHax1hUAtH0nKUyh3NMz3p4JTZS3pPPldR8YpI7FaLGVefw0DLCLRXoN0vJB7sGalsvR1FgJhcvicgjWMGCH9F4";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Re-subscribe transparently when the browser rotates the push endpoint.
// New endpoint will be picked up next time the user opens the app and the
// Profile screen reads `push_subscriptions` (or on next reminder send,
// 410/404 prunes the old row). We just need to keep the OS-level subscription alive.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      .catch(() => {})
  );
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

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

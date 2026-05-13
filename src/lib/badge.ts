// Web Badging API helper. Clears the PWA app-icon badge and any lingering
// notifications whenever the app is opened or returns to the foreground.

function clearBadge() {
  try {
    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    if (typeof nav.clearAppBadge === "function") {
      nav.clearAppBadge().catch(() => {});
    }
  } catch { /* ignore */ }

  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.active?.postMessage({ type: "CLEAR_BADGE" });
      }).catch(() => {});
    }
  } catch { /* ignore */ }
}

export function initBadgeClearing() {
  if (typeof window === "undefined") return;

  clearBadge();

  window.addEventListener("focus", clearBadge);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") clearBadge();
  });
  window.addEventListener("pageshow", clearBadge);
}

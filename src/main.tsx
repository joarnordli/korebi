import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initBadgeClearing } from "./lib/badge";

// Register service worker for push notifications.
// Skip in the Lovable editor preview iframe to avoid stale-cache issues.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if ("serviceWorker" in navigator) {
  if (isInIframe || isPreviewHost) {
    // Clean up any SW registered from a previous non-iframe load
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => {});
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed silently
      });
    });
  }
}

initBadgeClearing();

createRoot(document.getElementById("root")!).render(<App />);

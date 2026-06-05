// Lightweight theme manager. Toggles the `.dark` class on <html>,
// persists the user's preference, and reacts to OS theme changes when
// the preference is "system".

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "okiro.theme";
const LIGHT_THEME_COLOR = "#E8607A";
const DARK_THEME_COLOR = "#1a1410";

let mql: MediaQueryList | null = null;
let mqlListener: ((e: MediaQueryListEvent) => void) | null = null;
const subscribers = new Set<() => void>();

export function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref !== "system") return pref;
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeColorMeta(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

export function applyTheme(pref: ThemePreference) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  updateThemeColorMeta(resolved);
}

export function setPreference(pref: ThemePreference) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
  subscribers.forEach((fn) => fn());
}

export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function initTheme() {
  if (typeof window === "undefined") return;
  const pref = getStoredPreference();
  applyTheme(pref);

  // React live to OS theme changes (only matters when pref === "system",
  // but applyTheme is cheap and correct either way).
  if (!mql && window.matchMedia) {
    mql = window.matchMedia("(prefers-color-scheme: dark)");
    mqlListener = () => {
      if (getStoredPreference() === "system") {
        applyTheme("system");
        subscribers.forEach((fn) => fn());
      }
    };
    mql.addEventListener("change", mqlListener);
  }
}

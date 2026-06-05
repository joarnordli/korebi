import { useEffect, useState, useCallback } from "react";
import {
  ThemePreference,
  getStoredPreference,
  resolveTheme,
  setPreference as setPref,
  subscribe,
} from "@/lib/theme";

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredPreference());
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolveTheme(getStoredPreference()));

  useEffect(() => {
    const sync = () => {
      const p = getStoredPreference();
      setPreferenceState(p);
      setResolved(resolveTheme(p));
    };
    const unsub = subscribe(sync);
    sync();
    return () => {
      unsub();
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => setPref(p), []);

  return { preference, resolved, setPreference };
}

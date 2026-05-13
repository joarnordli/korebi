import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscribed: boolean;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  subscriptionEnd: string | null;
  subscriptionLoading: boolean;
  checkSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  subscribed: false,
  isTrialing: false,
  trialDaysLeft: null,
  subscriptionEnd: null,
  subscriptionLoading: true,
  checkSubscription: async () => {},
  signOut: async () => {},
});

const SUB_CACHE_KEY = "okiro.subCache.v1";
const SUB_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

type SubCache = {
  subscribed: boolean;
  is_trialing: boolean;
  trial_days_left: number | null;
  subscription_end: string | null;
  cachedAt: number;
};

function readSubCache(): SubCache | null {
  try {
    const raw = localStorage.getItem(SUB_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SubCache;
    if (!parsed || typeof parsed.cachedAt !== "number") return null;
    if (Date.now() - parsed.cachedAt > SUB_CACHE_MAX_AGE) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSubCache(c: Omit<SubCache, "cachedAt">) {
  try {
    localStorage.setItem(SUB_CACHE_KEY, JSON.stringify({ ...c, cachedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const cached = typeof window !== "undefined" ? readSubCache() : null;
  const [subscribed, setSubscribed] = useState(cached?.subscribed ?? false);
  const [isTrialing, setIsTrialing] = useState(cached?.is_trialing ?? false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(cached?.trial_days_left ?? null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(cached?.subscription_end ?? null);
  // If we have a cached value, treat as not loading so the UI renders immediately.
  const [subscriptionLoading, setSubscriptionLoading] = useState(!cached);

  // Deduplicate concurrent calls
  const checkInFlight = useRef<Promise<void> | null>(null);

  const checkSubscription = useCallback(async () => {
    if (checkInFlight.current) return checkInFlight.current;
    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (error) throw error;
        const sub = data?.subscribed ?? false;
        const tr = data?.is_trialing ?? false;
        const tdl = data?.trial_days_left ?? null;
        const end = data?.subscription_end ?? null;
        setSubscribed(sub);
        setIsTrialing(tr);
        setTrialDaysLeft(tdl);
        setSubscriptionEnd(end);
        writeSubCache({ subscribed: sub, is_trialing: tr, trial_days_left: tdl, subscription_end: end });
      } catch {
        // Don't flip subscribed to false on transient errors when we have a cached value;
        // the periodic refresh will retry. Only clear cache on explicit sign-out.
      } finally {
        setSubscriptionLoading(false);
        checkInFlight.current = null;
      }
    })();
    checkInFlight.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) {
          setTimeout(() => checkSubscription(), 0);
        } else {
          setSubscribed(false);
          setIsTrialing(false);
          setTrialDaysLeft(null);
          setSubscriptionEnd(null);
          setSubscriptionLoading(false);
          try { localStorage.removeItem(SUB_CACHE_KEY); } catch { /* ignore */ }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        checkSubscription();
      } else {
        setSubscriptionLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkSubscription]);

  // Periodic refresh every 60s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const signOut = async () => {
    const { clearSaltCache } = await import("@/lib/crypto");
    const { clearDecryptCache } = await import("@/lib/memories");
    clearSaltCache();
    clearDecryptCache();
    try { localStorage.removeItem(SUB_CACHE_KEY); } catch { /* ignore */ }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        subscribed,
        isTrialing,
        trialDaysLeft,
        subscriptionEnd,
        subscriptionLoading,
        checkSubscription,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

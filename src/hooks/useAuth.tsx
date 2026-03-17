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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [isTrialing, setIsTrialing] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  // Deduplicate concurrent calls
  const checkInFlight = useRef<Promise<void> | null>(null);

  const checkSubscription = useCallback(async () => {
    if (checkInFlight.current) return checkInFlight.current;
    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (error) throw error;
        setSubscribed(data?.subscribed ?? false);
        setIsTrialing(data?.is_trialing ?? false);
        setTrialDaysLeft(data?.trial_days_left ?? null);
        setSubscriptionEnd(data?.subscription_end ?? null);
      } catch {
        setSubscribed(false);
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
          setSubscriptionLoading(false);
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

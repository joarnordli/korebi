import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PushOpenTracker() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const eventId = params.get("n");
      if (!eventId || !UUID_RE.test(eventId)) return;
      supabase.functions.invoke("track-push-open", { body: { eventId } }).catch(() => {});
      params.delete("n");
      const search = params.toString();
      const newUrl =
        window.location.pathname +
        (search ? `?${search}` : "") +
        window.location.hash;
      window.history.replaceState({}, "", newUrl);
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Subscribe = lazy(() => import("./pages/Subscribe"));
const Landing = lazy(() => import("./pages/Landing"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Cookies = lazy(() => import("./pages/legal/Cookies"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 24 * 60 * 60 * 1000, // keep cache for 24h so persistence is meaningful
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "okiro.rq.v1",
  throttleTime: 1000,
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, subscribed, subscriptionLoading } = useAuth();
  // Wait only for auth state; subscription may still be revalidating in the background.
  if (loading) return null;
  if (!user) return <Navigate to="/welcome" replace />;
  // If subscription has finished loading and user is not subscribed, redirect.
  // While subscriptionLoading is true (cold first-ever load), let the app render
  // optimistically — the periodic refresh will redirect later if needed.
  if (!subscriptionLoading && !subscribed) return <Navigate to="/subscribe" replace />;
  return <>{children}</>;
}

function SubscribeRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, subscribed, subscriptionLoading } = useAuth();
  if (loading || subscriptionLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (subscribed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: "v2",
      dehydrateOptions: {
        // Only persist lightweight, non-ephemeral query data. The `memories`
        // query contains blob: / signed URLs that go stale across reloads,
        // so we deliberately exclude it and let it refetch on mount.
        shouldDehydrateQuery: (query) => {
          const key = query.queryKey?.[0];
          return key === "hasTodayMemory";
        },
      },
    }}
  >
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PushOpenTracker />
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/welcome" element={<PublicRoute><Landing /></PublicRoute>} />
              <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
              <Route path="/subscribe" element={<SubscribeRoute><Subscribe /></SubscribeRoute>} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/cookies" element={<Cookies />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;

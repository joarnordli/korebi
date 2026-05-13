import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
      // Fire-and-forget; failure is fine
      supabase.functions.invoke("track-push-open", { body: { eventId } }).catch(() => {});
      // Strip the param so reloads don't double-count
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

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, subscribed, subscriptionLoading } = useAuth();
  if (loading || subscriptionLoading) return null;
  if (!user) return <Navigate to="/welcome" replace />;
  if (!subscribed) return <Navigate to="/subscribe" replace />;
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
  <QueryClientProvider client={queryClient}>
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

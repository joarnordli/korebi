import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, BookOpen, User, RefreshCw, Shuffle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import CaptureScreen from "@/components/CaptureScreen";
import MemoriesFeed from "@/components/MemoriesFeed";
import ReliveFeed from "@/components/ReliveFeed";
import okiroLogo from "@/assets/okiro-logo.png";
import { toast } from "sonner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useMemories } from "@/hooks/useMemories";
import { useRelive } from "@/hooks/useRelive";

type Tab = "today" | "memories" | "relive";
const TAB_ORDER: Tab[] = ["today", "memories", "relive"];

export default function Index() {
  const { user, checkSubscription } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("today");
  const { memories, todayCaptured, streak, loading, refresh } = useMemories();
  const relive = useRelive();
  // Note: we intentionally do NOT auto-switch tabs based on `todayCaptured`.
  // `handleSaved` switches to "memories" right after a successful capture,
  // which lets users freely navigate back to "today" afterwards (e.g. to retake/edit).

  const { containerRef, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: async () => {
      await refresh();
      if (tab === "relive") {
        relive.reshuffle();
      }
    }
  });

  // Handle checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast.success("Subscription activated!");
      checkSubscription();
      window.history.replaceState({}, "", "/");
    }
  }, [checkSubscription]);

  // No manual refresh on mount needed — React Query handles it

  // Swipe to switch tabs
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const swiping = useRef(false);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    swiping.current = true;
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;
    swiping.current = false;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const idx = TAB_ORDER.indexOf(tab);
      if (dx < 0 && idx < TAB_ORDER.length - 1) setTab(TAB_ORDER[idx + 1]);
      if (dx > 0 && idx > 0) setTab(TAB_ORDER[idx - 1]);
    }
  }, [tab]);

  const handleSaved = () => {
    setTab("memories");
    // Fire-and-forget invalidation. Won't flip `loading` (isLoading) since
    // both queries already have cached data — only `isFetching` toggles,
    // which the UI does not gate on.
    refresh();
  };

  if (loading && memories.length === 0) {
    return (
      <div className="min-h-[100dvh] h-[100dvh] bg-background flex flex-col max-w-md mx-auto overflow-hidden">
        <div
          className="shrink-0 px-6 pb-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={okiroLogo} alt="Okiro" className="w-7 h-7" />
              <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Okiro<span className="sr-only"> — One photo. One thought. Every day.</span></h1>
            </div>
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden px-6 pt-4 space-y-4">

          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card rounded-2xl shadow-card overflow-hidden">
              <div className="aspect-square bg-muted animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pullProgress = Math.min(pullDistance / 80, 1);

  return (
    <div className="relative min-h-[100dvh] h-[100dvh] bg-background flex flex-col max-w-md mx-auto overflow-hidden">

      {/* Static header */}
      <div
        className="shrink-0 backdrop-blur-xl"
        style={{
          background: "hsl(var(--background))",
          touchAction: "none",
          paddingTop: "env(safe-area-inset-top)",
        }}
        onTouchMove={(e) => e.preventDefault()}>
        
        <header className="px-6 pb-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={okiroLogo} alt="Okiro" className="w-7 h-7" />
              <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
                Okiro<span className="sr-only"> — One photo. One thought. Every day.</span>
              </h1>
            </div>
            <button
              onClick={() => navigate("/profile")}
              className="rounded-full"
              title="Profile">
              
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} alt="Profile" />
                <AvatarFallback className="bg-secondary">
                  <User className="w-4 h-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
        </header>

      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{
          overscrollBehavior: "none",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 84px)",
        }}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}>

        
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
          style={{
            height: pullDistance > 0 ? `${pullDistance}px` : "0px",
            transition: pullDistance > 0 ? "none" : "height 0.3s ease-out"
          }}>
          
          <div
            className="flex items-center justify-center"
            style={{
              opacity: pullProgress,
              transform: `rotate(${pullProgress * 360}deg)`
            }}>
            
            <RefreshCw
              className={`w-5 h-5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
            
          </div>
        </div>

        <AnimatePresence mode="wait">
          {tab === "today" && (
            <motion.div
              key="today"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}>
              {todayCaptured ?
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                  <img src={okiroLogo} alt="Okiro" className="w-10 h-10 mb-4" />
                  <p className="font-display text-lg text-foreground">
                    Today's moment captured
                  </p>
                  <p className="font-body text-sm text-muted-foreground mt-1">
                    Come back tomorrow for a new memory
                  </p>
                  {streak > 0 && (
                    <div className="mt-4 flex items-center gap-1.5">
                      <span className="text-2xl font-display font-bold text-accent">{streak}</span>
                      <span className="font-body text-sm text-muted-foreground">day streak 🔥</span>
                    </div>
                  )}
                </div> :
                <CaptureScreen onSaved={handleSaved} />
              }
            </motion.div>
          )}
          {tab === "memories" && (
            <motion.div
              key="memories"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}>
              <MemoriesFeed memories={memories} onUpdated={refresh} />
            </motion.div>
          )}
          {tab === "relive" && (
            <motion.div
              key="relive"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}>
              <ReliveFeed
                memories={relive.memories}
                onUpdated={refresh}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating glass tab bar */}
      <nav
        className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        aria-label="Primary"
      >
        <div className="glass-pill pointer-events-auto flex items-center gap-1 p-1.5">
          {[
            { key: "today" as Tab, label: "Today", icon: Camera, badge: !todayCaptured },
            { key: "memories" as Tab, label: "Memories", icon: BookOpen, badge: false },
            { key: "relive" as Tab, label: "Relive", icon: Shuffle, badge: false },
          ].map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`nav-pill-btn flex items-center justify-center gap-1.5 h-11 px-4 rounded-full font-body text-sm font-medium transition-all relative ${
                tab === key
                  ? "bg-foreground text-background shadow-card"
                  : "text-foreground/70 hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="nav-pill-label">{label}</span>
              {badge && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              )}
            </button>
          ))}
        </div>
      </nav>

    </div>);


}
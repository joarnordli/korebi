import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, BookOpen, User, RefreshCw } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getMemories, hasTodayMemory, Memory } from "@/lib/memories";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import CaptureScreen from "@/components/CaptureScreen";
import MemoriesFeed from "@/components/MemoriesFeed";
import okiroLogo from "@/assets/okiro-logo.png";
import { toast } from "sonner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

type Tab = "today" | "memories";

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("today");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [todayCaptured, setTodayCaptured] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [mems, hasToday] = await Promise.all([getMemories(), hasTodayMemory()]);
      setMemories(mems);
      setTodayCaptured(hasToday);
      if (hasToday && tab === "today") setTab("memories");
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const { containerRef, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: refresh,
  });

  // Handle checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast.success("Subscription activated!");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);

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
    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && tab === "today") setTab("memories");
      if (dx > 0 && tab === "memories") setTab("today");
    }
  }, [tab]);

  const handleSaved = () => {
    refresh();
    setTab("memories");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <img src={okiroLogo} alt="Okiro" className="w-8 h-8 animate-pulse" />
      </div>
    );
  }

  const pullProgress = Math.min(pullDistance / 80, 1);

  return (
    <div className="h-screen bg-background flex flex-col max-w-md mx-auto overflow-hidden">
      {/* Fixed header */}
      <div className="fixed top-0 left-0 right-0 z-10 backdrop-blur-xl bg-background/70 max-w-md mx-auto">
        <header className="px-6 pt-12 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={okiroLogo} alt="Okiro" className="w-7 h-7" />
              <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
                Okiro
              </h1>
            </div>
            <button
              onClick={() => navigate("/profile")}
              className="rounded-full"
              title="Profile"
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} alt="Profile" />
                <AvatarFallback className="bg-secondary">
                  <User className="w-4 h-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
          <p className="font-body text-sm text-muted-foreground mt-1">
            One photo. One thought. Every day.
          </p>
        </header>

        <div className="px-6 pb-2">
          <div className="flex bg-secondary rounded-xl p-1">
            {[
              { key: "today" as Tab, label: "Today", icon: Camera, badge: !todayCaptured },
              { key: "memories" as Tab, label: "Memories", icon: BookOpen },
            ].map(({ key, label, icon: Icon, badge }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-body text-sm font-medium transition-all relative ${
                  tab === key
                    ? "bg-background text-foreground shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge && (
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fade-out edge */}
        <div
          className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none translate-y-full"
          style={{
            background: "linear-gradient(to bottom, hsl(var(--background) / 0.7), transparent)",
          }}
        />
      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto pt-[180px]"
        style={{ overscrollBehavior: "none" }}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
          style={{
            height: pullDistance > 0 ? `${pullDistance}px` : "0px",
            transition: pullDistance > 0 ? "none" : "height 0.3s ease-out",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              opacity: pullProgress,
              transform: `rotate(${pullProgress * 360}deg)`,
            }}
          >
            <RefreshCw
              className={`w-5 h-5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {tab === "today" ? (
            <motion.div
              key="today"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {todayCaptured ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <img src={okiroLogo} alt="Okiro" className="w-8 h-8" />
                  </div>
                  <p className="font-display text-lg text-foreground">
                    Today's moment captured
                  </p>
                  <p className="font-body text-sm text-muted-foreground mt-1">
                    Come back tomorrow for a new memory
                  </p>
                </div>
              ) : (
                <CaptureScreen onSaved={handleSaved} />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="memories"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <MemoriesFeed memories={memories} onUpdated={refresh} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

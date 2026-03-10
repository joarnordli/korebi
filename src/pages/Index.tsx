import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, BookOpen, LogOut, Settings } from "lucide-react";
import { getMemories, hasTodayMemory, Memory } from "@/lib/memories";
import { useAuth } from "@/hooks/useAuth";
import CaptureScreen from "@/components/CaptureScreen";
import MemoriesFeed from "@/components/MemoriesFeed";
import okiroLogo from "@/assets/okiro-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tab = "today" | "memories";

export default function Index() {
  const { user, signOut } = useAuth();
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

  // Handle checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast.success("Subscription activated!");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to open subscription management");
    }
  };

  useEffect(() => {
    refresh();
  }, []);

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

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      <header className="px-6 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={okiroLogo} alt="Okiro" className="w-7 h-7" />
            <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
              Okiro
            </h1>
          </div>
          <button
            onClick={signOut}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
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
                <span className="w-2 h-2 rounded-full bg-accent absolute top-2 right-[calc(50%-28px)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
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

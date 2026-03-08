import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, BookOpen, Sparkles } from "lucide-react";
import { getMemories, hasTodayMemory } from "@/lib/memories";
import CaptureScreen from "@/components/CaptureScreen";
import MemoriesFeed from "@/components/MemoriesFeed";

type Tab = "today" | "memories";

export default function Index() {
  const [tab, setTab] = useState<Tab>(hasTodayMemory() ? "memories" : "today");
  const [memories, setMemories] = useState(getMemories);
  const [todayCaptured, setTodayCaptured] = useState(hasTodayMemory);

  const refresh = useCallback(() => {
    setMemories(getMemories());
    setTodayCaptured(hasTodayMemory());
  }, []);

  const handleSaved = () => {
    refresh();
    setTab("memories");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="px-6 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
            Daylight
          </h1>
        </div>
        <p className="font-body text-sm text-muted-foreground mt-1">
          One photo. One thought. Every day.
        </p>
      </header>

      {/* Tab bar */}
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

      {/* Content */}
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
                    <Sparkles className="w-6 h-6 text-primary" />
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
              <MemoriesFeed memories={memories} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

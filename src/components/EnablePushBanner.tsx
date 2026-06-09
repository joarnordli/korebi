import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  enablePush,
  pushSupported,
  isIOSWithoutStandalone,
  markPushDismissed,
} from "@/lib/push";


const SESSION_HIDE_KEY = "okiro:push_banner_session_hidden";

export default function EnablePushBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!pushSupported()) return;
    if (isIOSWithoutStandalone()) return;
    // Show only when permission is still pending ("default").
    // "granted" → no need; "denied" → user must re-enable in OS settings.
    if (Notification.permission !== "default") return;
    try {
      if (sessionStorage.getItem(SESSION_HIDE_KEY) === "1") return;
    } catch { /* ignore */ }
    setVisible(true);
  }, [user]);


  const handleEnable = async () => {
    if (!user || busy) return;
    setBusy(true);
    const res = await enablePush(user.id);
    setBusy(false);
    if (res.status === "granted") {
      toast.success("Daily reminders enabled.");
      setVisible(false);
    } else if (res.status === "denied") {
      toast.error("Enable notifications in your browser or device settings to receive reminders.");
    } else if (res.status === "error") {
      toast.error(res.error.message || "Could not enable reminders.");
    }
  };

  const handleDismiss = () => {
    try { sessionStorage.setItem(SESSION_HIDE_KEY, "1"); } catch { /* ignore */ }
    markPushDismissed();
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="mx-6 mt-4 rounded-2xl border border-border bg-card shadow-card p-4 flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm font-medium text-foreground">
              Get a gentle daily nudge
            </p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              We'll remind you each morning to capture today's moment.
            </p>
            <button
              onClick={handleEnable}
              disabled={busy}
              className="mt-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-body text-xs font-semibold disabled:opacity-60"
            >
              {busy ? "Enabling…" : "Enable reminders"}
            </button>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

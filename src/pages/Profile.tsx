import { useState } from "react";
import { motion } from "framer-motion";
import { LogOut, Download, Crown, ArrowLeft, Loader2, Check, User } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import okiroLogo from "@/assets/okiro-logo.png";

export default function Profile() {
  const { user, signOut, subscribed, isTrialing, trialDaysLeft, subscriptionEnd, checkSubscription, subscriptionLoading } = useAuth();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to open subscription management");
    } finally {
      setManagingSubscription(false);
    }
  };

  const handleStartSubscription = async () => {
    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    } finally {
      setManagingSubscription(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data: memories, error } = await supabase
        .from("memories")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw error;
      if (!memories || memories.length === 0) {
        toast.info("No memories to download yet.");
        return;
      }

      // Dynamic import JSZip
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add a metadata JSON
      const metadata = memories.map((m) => ({
        date: m.date,
        note: m.note,
        created_at: m.created_at,
      }));
      zip.file("memories.json", JSON.stringify(metadata, null, 2));

      // Download each image and add to zip
      for (const memory of memories) {
        try {
          const response = await fetch(memory.image_url);
          if (!response.ok) continue;
          const blob = await response.blob();
          const ext = memory.image_url.split(".").pop()?.split("?")[0] || "jpg";
          const filename = `${memory.date}${memory.note ? " - " + memory.note.slice(0, 40).replace(/[/\\?%*:|"<>]/g, "") : ""}.${ext}`;
          zip.file(filename, blob);
        } catch {
          // Skip failed downloads
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `okiro-memories-${new Date().toISOString().split("T")[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${memories.length} memories!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to download memories");
    } finally {
      setDownloading(false);
    }
  };

  const trialProgress = trialDaysLeft !== null ? Math.max(0, Math.min(100, ((7 - trialDaysLeft) / 7) * 100)) : 0;
  const isPaidSubscriber = subscribed && !isTrialing;

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      <header className="px-6 pt-12 pb-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <img src={okiroLogo} alt="" className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Profile</h1>
            <p className="font-body text-sm text-muted-foreground truncate max-w-[220px]">
              {user?.email}
            </p>
          </div>
        </div>
      </header>

      <div className="px-6 space-y-4 flex-1">
        {/* Subscription Status */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-2xl shadow-card p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm font-bold text-foreground">Subscription</h2>
          </div>

          {subscriptionLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="font-body text-sm text-muted-foreground">Checking status…</span>
            </div>
          ) : isTrialing ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-body text-sm text-foreground">Free trial</span>
                <span className="font-body text-xs text-muted-foreground">
                  {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left
                </span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${trialProgress}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
              <p className="font-body text-xs text-muted-foreground mt-2">
                After your trial, it's 7 NOK/week to continue.
              </p>
            </div>
          ) : isPaidSubscriber ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-primary" />
                <span className="font-body text-sm text-foreground font-medium">Active subscription</span>
              </div>
              <p className="font-body text-xs text-muted-foreground">
                7 NOK/week · {subscriptionEnd
                  ? `Renews ${new Date(subscriptionEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : ""}
              </p>
              <button
                onClick={handleManageSubscription}
                disabled={managingSubscription}
                className="mt-3 w-full py-2.5 rounded-xl border border-border bg-background font-body text-sm font-medium text-foreground flex items-center justify-center gap-2 hover:bg-secondary transition-colors disabled:opacity-60"
              >
                {managingSubscription ? <Loader2 className="w-4 h-4 animate-spin" /> : "Manage subscription"}
              </button>
            </div>
          ) : (
            <div>
              <p className="font-body text-sm text-muted-foreground mb-3">
                Your free trial has ended. Subscribe to keep using Okiro.
              </p>
              <button
                onClick={handleStartSubscription}
                disabled={managingSubscription}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm font-semibold flex items-center justify-center gap-2 shadow-card disabled:opacity-60"
              >
                {managingSubscription ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <Crown className="w-4 h-4" />
                    Subscribe — 7 NOK/week
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>

        {/* Download Memories */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl shadow-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm font-bold text-foreground">Your data</h2>
          </div>
          <p className="font-body text-xs text-muted-foreground mb-3">
            Download all your photos and notes as a zip file. Your memories are always yours.
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full py-2.5 rounded-xl border border-border bg-background font-body text-sm font-medium text-foreground flex items-center justify-center gap-2 hover:bg-secondary transition-colors disabled:opacity-60"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing download…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download all memories
              </>
            )}
          </button>
        </motion.div>

        {/* Sign Out */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <button
            onClick={signOut}
            className="w-full py-3 rounded-xl border border-border bg-card font-body text-sm font-medium text-destructive flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors shadow-card"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </motion.div>
      </div>

      <footer className="px-6 py-6 text-center">
        <p className="font-body text-xs text-muted-foreground">
          © {new Date().getFullYear()} Okiro
        </p>
      </footer>
    </div>
  );
}

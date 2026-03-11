import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LogOut, Download, Crown, ArrowLeft, Loader2, Check, User, Trash2, Bell } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import okiroLogo from "@/assets/okiro-logo.png";

const VAPID_PUBLIC_KEY = "BHax1hUAtH0nKUyh3NMz3p4JTZS3pPPldR8YpI7FaLGVefw0DLCLRXoN0vJB7sGalsvR1FgJhcvicgjWMGCH9F4";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function Profile() {
  const { user, signOut, subscribed, isTrialing, trialDaysLeft, subscriptionEnd, checkSubscription, subscriptionLoading } = useAuth();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [togglingReminders, setTogglingReminders] = useState(false);

  // Check current reminder status
  useEffect(() => {
    if (!user) return;
    const checkReminders = async () => {
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id, reminder_enabled")
        .eq("user_id", user.id)
        .limit(1);
      setRemindersEnabled(data && data.length > 0 && data[0].reminder_enabled);
      setRemindersLoading(false);
    };
    checkReminders();
  }, [user]);

  const handleToggleReminders = async (enabled: boolean) => {
    if (togglingReminders) return;
    setTogglingReminders(true);

    try {
      if (enabled) {
        // Request notification permission
        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
          toast.error("Push notifications are not supported in this browser.");
          setTogglingReminders(false);
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notification permission denied. Please enable it in your browser settings.");
          setTogglingReminders(false);
          return;
        }

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        const subJson = subscription.toJSON();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Save to database
        await supabase.from("push_subscriptions").upsert(
          {
            user_id: user!.id,
            endpoint: subJson.endpoint!,
            p256dh: subJson.keys!.p256dh!,
            auth: subJson.keys!.auth!,
            timezone,
            reminder_enabled: true,
          },
          { onConflict: "user_id,endpoint" }
        );

        setRemindersEnabled(true);
        toast.success("Daily reminders enabled! You'll get a nudge between 10 AM and 10 PM.");
      } else {
        // Unsubscribe from push
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) await subscription.unsubscribe();
        } catch {
          // Continue even if unsubscribe fails
        }

        // Remove from database
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user!.id);

        setRemindersEnabled(false);
        toast.success("Daily reminders disabled.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update reminder settings");
    } finally {
      setTogglingReminders(false);
    }
  };

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

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const metadata = memories.map((m) => ({
        date: m.date,
        note: m.note,
        created_at: m.created_at,
      }));
      zip.file("memories.json", JSON.stringify(metadata, null, 2));

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await signOut();
      navigate("/welcome", { replace: true });
      toast.success("Your account and all data have been permanently deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
      setDeleting(false);
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
          <Avatar className="w-12 h-12">
            <AvatarImage src={user?.user_metadata?.avatar_url} alt="Profile" />
            <AvatarFallback className="bg-primary/10">
              <User className="w-6 h-6 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
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

        {/* Daily Reminders */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-card rounded-2xl shadow-card p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <div>
                <h2 className="font-display text-sm font-bold text-foreground">Daily reminders</h2>
                <p className="font-body text-xs text-muted-foreground mt-0.5">
                  Get a daily reminder between 10 AM and 10 PM to capture your moment
                </p>
              </div>
            </div>
            {remindersLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={remindersEnabled}
                onCheckedChange={handleToggleReminders}
                disabled={togglingReminders}
              />
            )}
          </div>
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

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="pt-4"
        >
          <p className="font-body text-xs text-muted-foreground mb-2 uppercase tracking-wider">Danger zone</p>
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="w-full py-3 rounded-xl border border-destructive/30 bg-card font-body text-sm font-medium text-destructive flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete account
          </button>
        </motion.div>
      </div>

      <footer className="px-6 py-6 text-center">
        <p className="font-body text-xs text-muted-foreground">
          © {new Date().getFullYear()} Okiro
        </p>
      </footer>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!deleting) {
          setDeleteDialogOpen(open);
          if (!open) setDeleteConfirmText("");
        }
      }}>
        <AlertDialogContent className="rounded-2xl max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg text-foreground">Delete your account?</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-sm text-muted-foreground">
              This will <strong className="text-foreground">permanently delete</strong> all your memories, photos, notes, and account data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="font-body text-xs text-muted-foreground block mb-1.5">
              Type <strong className="text-foreground">DELETE</strong> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deleting}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-destructive/30 disabled:opacity-60"
            />
          </div>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel disabled={deleting} className="flex-1 rounded-xl font-body text-sm">
              Cancel
            </AlertDialogCancel>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || deleting}
              className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground font-body text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? "Deleting…" : "Delete forever"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

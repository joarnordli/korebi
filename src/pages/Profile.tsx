import { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { LogOut, Download, Crown, ArrowLeft, Loader2, Check, User, Trash2, Bell, Flame, MapPin, Megaphone, Send } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemories } from "@/hooks/useMemories";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel } from
"@/components/ui/alert-dialog";
import okiroLogo from "@/assets/okiro-logo.png";

// Lazy-load heavy modules so they don't bloat the initial Profile chunk.
const AdminPanel = lazy(() => import("@/components/AdminPanel"));
const MemoryMap = lazy(() => import("@/components/MemoryMap"));

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function arrayBuffersEqual(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a) return false;
  const av = new Uint8Array(a);
  if (av.length !== b.length) return false;
  for (let i = 0; i < av.length; i++) if (av[i] !== b[i]) return false;
  return true;
}

interface MemoryLocation {
  date: string;
  note: string | null;
  latitude: number;
  longitude: number;
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
  const [sendingTest, setSendingTest] = useState(false);
  const [windowStart, setWindowStart] = useState(10);
  const [windowEnd, setWindowEnd] = useState(21);
  const [savingWindow, setSavingWindow] = useState(false);

  // ===== Admin broadcast =====
  const ADMIN_USER_IDS = new Set<string>(["123f18ad-9a45-4dcb-9527-61cb2be423d0"]);
  const isAdmin = !!user && ADMIN_USER_IDS.has(user.id);
  const [bcTitle, setBcTitle] = useState("Okiro");
  const [bcBody, setBcBody] = useState("");
  const [bcUrl, setBcUrl] = useState("/");
  const [bcAudience, setBcAudience] = useState<"all_enabled" | "all_subscriptions" | "self">("all_enabled");
  const [bcRecipients, setBcRecipients] = useState<number | null>(null);
  const [bcPreviewing, setBcPreviewing] = useState(false);
  const [bcConfirmOpen, setBcConfirmOpen] = useState(false);
  const [bcConfirmText, setBcConfirmText] = useState("");
  const [bcSending, setBcSending] = useState(false);
  const [bcResult, setBcResult] = useState<{ sent: number; failed: number; expired_cleaned: number } | null>(null);

  const handleBcPreview = async () => {
    setBcPreviewing(true);
    setBcRecipients(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-broadcast", {
        body: { preview: true, audience: bcAudience },
      });
      if (error) throw error;
      setBcRecipients(data?.recipients ?? 0);
    } catch (err: any) {
      toast.error(err.message || "Could not preview audience");
    } finally {
      setBcPreviewing(false);
    }
  };

  const handleBcSend = async () => {
    if (bcConfirmText !== "SEND") return;
    setBcSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-broadcast", {
        body: {
          title: bcTitle.trim(),
          body: bcBody.trim(),
          url: bcUrl.trim() || "/",
          audience: bcAudience,
        },
      });
      if (error) throw error;
      setBcResult({
        sent: data?.sent ?? 0,
        failed: data?.failed ?? 0,
        expired_cleaned: data?.expired_cleaned ?? 0,
      });
      toast.success(`Broadcast sent to ${data?.sent ?? 0} device${data?.sent === 1 ? "" : "s"}.`);
      setBcConfirmOpen(false);
      setBcConfirmText("");
      setBcBody("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send broadcast");
    } finally {
      setBcSending(false);
    }
  };

  const { streak, locations } = useMemories();

  // Check current reminder status
  useEffect(() => {
    if (!user) return;
    const checkReminders = async () => {
      const { data } = await supabase.
      from("push_subscriptions").
      select("id, reminder_enabled, reminder_window_start, reminder_window_end").
      eq("user_id", user.id).
      limit(1);
      const row = data && data.length > 0 ? data[0] : null;
      setRemindersEnabled(!!row?.reminder_enabled);
      if (row) {
        setWindowStart(row.reminder_window_start ?? 10);
        setWindowEnd(row.reminder_window_end ?? 21);
      }
      setRemindersLoading(false);
    };
    checkReminders();
  }, [user]);

  const handleToggleReminders = async (enabled: boolean) => {
    if (togglingReminders) return;
    setTogglingReminders(true);

    try {
      if (enabled) {
        if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
          toast.error("Push notifications are not supported in this browser.");
          setTogglingReminders(false);
          return;
        }

        // iOS Safari requires the app be installed to the Home Screen
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone =
          (window.navigator as any).standalone === true ||
          window.matchMedia("(display-mode: standalone)").matches;
        if (isIOS && !isStandalone) {
          toast.error("On iPhone, add Okiro to your Home Screen first, then open it from there to enable reminders.");
          setTogglingReminders(false);
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notification permission denied. Please enable it in your browser settings.");
          setTogglingReminders(false);
          return;
        }

        // Race the SW ready against a timeout so a failed SW registration doesn't hang us forever
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<ServiceWorkerRegistration>((_, reject) =>
            setTimeout(() => reject(new Error("Service worker not ready (registration may have failed)")), 5000)
          ),
        ]);

        // Always use the backend's current VAPID public key so client and server stay in sync
        const { data: keyData, error: keyError } = await supabase.functions.invoke("get-vapid-key");
        if (keyError || !keyData?.publicKey) {
          throw new Error("Could not fetch push key from server");
        }
        const vapidKey = keyData.publicKey as string;
        const vapidKeyBytes = urlBase64ToUint8Array(vapidKey);

        // If the device already has a subscription bound to a different key, drop it first
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          const existingKey = existing.options?.applicationServerKey ?? null;
          if (!arrayBuffersEqual(existingKey, vapidKeyBytes)) {
            try { await existing.unsubscribe(); } catch { /* ignore */ }
            await supabase.from("push_subscriptions").delete().eq("endpoint", existing.endpoint);
          }
        }

        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKeyBytes,
          }));

        const subJson = subscription.toJSON();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const { error: upsertError } = await supabase.from("push_subscriptions").upsert(
          {
            user_id: user!.id,
            endpoint: subJson.endpoint!,
            p256dh: subJson.keys!.p256dh!,
            auth: subJson.keys!.auth!,
            timezone,
            reminder_enabled: true
          },
          { onConflict: "user_id,endpoint" }
        );
        if (upsertError) throw upsertError;

        setRemindersEnabled(true);
        toast.success("Daily reminders enabled! You'll get a nudge between 10 AM and 10 PM.");
      } else {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) await subscription.unsubscribe();
        } catch {
          // Continue even if unsubscribe fails
        }
        await supabase.
        from("push_subscriptions").
        delete().
        eq("user_id", user!.id);

        setRemindersEnabled(false);
        toast.success("Daily reminders disabled.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update reminder settings");
    } finally {
      setTogglingReminders(false);
    }
  };

  const handleSendTest = async () => {
    if (sendingTest) return;
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-notification");
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success(`Test notification sent to ${data.sent} device${data.sent === 1 ? "" : "s"}. Check your phone!`);
      } else {
        const reason = data?.results?.[0]?.reason || "Unknown error";
        toast.error(`Couldn't send test (${reason}). Try toggling reminders off and on.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send test notification");
    } finally {
      setSendingTest(false);
    }
  };

  const handleSaveWindow = async (newStart: number, newEnd: number) => {
    if (!user || savingWindow) return;
    if (newStart > newEnd) {
      toast.error("Start time must be before end time.");
      return;
    }
    setSavingWindow(true);
    const prevStart = windowStart, prevEnd = windowEnd;
    setWindowStart(newStart);
    setWindowEnd(newEnd);
    try {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ reminder_window_start: newStart, reminder_window_end: newEnd })
        .eq("user_id", user.id);
      if (error) throw error;
    } catch (err: any) {
      setWindowStart(prevStart);
      setWindowEnd(prevEnd);
      toast.error(err.message || "Failed to save reminder window");
    } finally {
      setSavingWindow(false);
    }
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
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
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    } finally {
      setManagingSubscription(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Reuse the decrypted feed loader so we get usable blob: URLs
      const { getMemories } = await import("@/lib/memories");
      const memories = await getMemories();
      if (memories.length === 0) {
        toast.info("No memories to download yet.");
        return;
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const metadata = memories.map((m) => ({
        date: m.date,
        note: m.note,
        latitude: m.latitude,
        longitude: m.longitude,
        created_at: m.created_at,
      }));
      zip.file("memories.json", JSON.stringify(metadata, null, 2));

      for (const memory of memories) {
        try {
          const response = await fetch(memory.image_url);
          if (!response.ok) continue;
          const blob = await response.blob();
          // Derive extension from the actual decrypted blob mime type
          const mime = blob.type || "image/webp";
          const ext = mime.includes("/") ? mime.split("/")[1].split(";")[0] : "webp";
          const safeNote = memory.note ? " - " + memory.note.slice(0, 40).replace(/[/\\?%*:|"<>]/g, "") : "";
          const filename = `${memory.date}${safeNote}.${ext}`;
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

  const trialProgress = trialDaysLeft !== null ? Math.max(0, Math.min(100, (7 - trialDaysLeft) / 7 * 100)) : 0;
  const isPaidSubscriber = subscribed && !isTrialing;

  // Compute map center from locations
  const mapCenter: [number, number] | null = locations.length > 0
    ? [
        locations.reduce((s, l) => s + l.latitude, 0) / locations.length,
        locations.reduce((s, l) => s + l.longitude, 0) / locations.length,
      ]
    : null;

  return (
    <div className="h-screen bg-background flex flex-col max-w-md mx-auto overflow-hidden">
      <header className="shrink-0 px-6 pt-4 pb-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3.5">
          <Avatar className="w-14 h-14">
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

      <div className="flex-1 overflow-y-auto px-6 pt-2 pb-4 space-y-4" style={{ overscrollBehavior: "none" }}>
        {/* Streak Counter */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          className="bg-card rounded-2xl shadow-card p-5 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Flame className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-foreground leading-none">
              {streak}
            </p>
            <p className="font-body text-sm text-muted-foreground mt-0.5">
              {streak === 1 ? "day streak" : "day streak"}
            </p>
          </div>
        </motion.div>

        {/* Photo Map */}
        {locations.length > 0 && mapCenter && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="bg-card rounded-2xl shadow-card overflow-hidden"
          >
            <div className="flex items-center gap-2 p-5 pb-3">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm font-bold text-foreground">Your memory map</h2>
            </div>
            <div className="h-48 w-full">
              <Suspense fallback={<div className="h-full w-full bg-muted animate-pulse" />}>
                <MemoryMap center={mapCenter} locations={locations} />
              </Suspense>
            </div>
          </motion.div>
        )}

        {/* Admin: Broadcast push */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.09 }}
            className="bg-card rounded-2xl shadow-card p-5 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm font-bold text-foreground">Admin · Broadcast</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">Title</label>
                <input
                  type="text"
                  value={bcTitle}
                  maxLength={80}
                  onChange={(e) => setBcTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">
                  Body <span className="text-muted-foreground/70">({bcBody.length}/200)</span>
                </label>
                <textarea
                  value={bcBody}
                  maxLength={200}
                  rows={3}
                  placeholder="What do you want to say?"
                  onChange={(e) => setBcBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">Open URL when tapped</label>
                <input
                  type="text"
                  value={bcUrl}
                  onChange={(e) => setBcUrl(e.target.value)}
                  placeholder="/"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">Audience</label>
                <select
                  value={bcAudience}
                  onChange={(e) => {
                    setBcAudience(e.target.value as any);
                    setBcRecipients(null);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="all_enabled">All users with reminders ON</option>
                  <option value="all_subscriptions">All push subscriptions</option>
                  <option value="self">Just me (dry run)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleBcPreview}
                  disabled={bcPreviewing}
                  className="flex-1 py-2 rounded-xl border border-border bg-background font-body text-xs font-medium text-foreground flex items-center justify-center gap-2 hover:bg-secondary transition-colors disabled:opacity-60">
                  {bcPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Count recipients"}
                </button>
                <button
                  onClick={() => {
                    if (!bcTitle.trim() || !bcBody.trim()) {
                      toast.error("Title and body are required");
                      return;
                    }
                    setBcConfirmOpen(true);
                  }}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-body text-xs font-semibold flex items-center justify-center gap-2">
                  <Send className="w-3.5 h-3.5" />
                  Send broadcast
                </button>
              </div>

              {bcRecipients !== null && (
                <p className="font-body text-xs text-muted-foreground">
                  This audience reaches <strong className="text-foreground">{bcRecipients}</strong> device{bcRecipients === 1 ? "" : "s"}.
                </p>
              )}
              {bcResult && (
                <p className="font-body text-xs text-muted-foreground">
                  Last send: <strong className="text-foreground">{bcResult.sent} delivered</strong>, {bcResult.failed} failed, {bcResult.expired_cleaned} expired cleaned.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {isAdmin && <AdminPanel />}

        {/* Subscription Status */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm font-bold text-foreground">Subscription</h2>
          </div>

          {subscriptionLoading ?
          <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="font-body text-sm text-muted-foreground">Checking status…</span>
            </div> :
          isTrialing ?
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
                className="h-full bg-primary rounded-full" />
              </div>
              <p className="font-body text-xs text-muted-foreground mt-2">
                After your trial, it's 7 NOK/week to continue.
              </p>
            </div> :
          isPaidSubscriber ?
          <div>
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-primary" />
                <span className="font-body text-sm text-foreground font-medium">Active subscription</span>
              </div>
              <p className="font-body text-xs text-muted-foreground">
                7 NOK/week · {subscriptionEnd ?
              `Renews ${new Date(subscriptionEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` :
              ""}
              </p>
              <button
              onClick={handleManageSubscription}
              disabled={managingSubscription}
              className="mt-3 w-full py-2.5 rounded-xl border border-border bg-background font-body text-sm font-medium text-foreground flex items-center justify-center gap-2 hover:bg-secondary transition-colors disabled:opacity-60">
                {managingSubscription ? <Loader2 className="w-4 h-4 animate-spin" /> : "Manage subscription"}
              </button>
            </div> :

          <div>
              <p className="font-body text-sm text-muted-foreground mb-3">
                Your free trial has ended. Subscribe to keep using Okiro.
              </p>
              <button
              onClick={handleStartSubscription}
              disabled={managingSubscription}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm font-semibold flex items-center justify-center gap-2 shadow-card disabled:opacity-60">
                {managingSubscription ? <Loader2 className="w-4 h-4 animate-spin" /> :
              <>
                    <Crown className="w-4 h-4" />
                    Subscribe — 7 NOK/week
                  </>
              }
              </button>
            </div>
          }
        </motion.div>

        {/* Daily Reminders */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-card rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <div>
                <h2 className="font-display text-sm font-bold text-foreground">Daily reminders</h2>
                <p className="font-body text-xs text-muted-foreground mt-0.5">
                  Get a daily reminder to capture your moment
                </p>
              </div>
            </div>
            {remindersLoading ?
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> :
            <Switch
              checked={remindersEnabled}
              onCheckedChange={handleToggleReminders}
              disabled={togglingReminders} />
            }
          </div>
          {remindersEnabled && !remindersLoading && (
            <>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="font-body text-xs text-muted-foreground mb-2">
                  Preferred time window <span className="text-muted-foreground/70">(your local time)</span>
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={windowStart}
                    onChange={(e) => handleSaveWindow(parseInt(e.target.value, 10), windowEnd)}
                    disabled={savingWindow}
                    className="flex-1 px-2 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h} disabled={h > windowEnd}>
                        {h.toString().padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                  <span className="font-body text-xs text-muted-foreground">to</span>
                  <select
                    value={windowEnd}
                    onChange={(e) => handleSaveWindow(windowStart, parseInt(e.target.value, 10))}
                    disabled={savingWindow}
                    className="flex-1 px-2 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h} disabled={h < windowStart}>
                        {h.toString().padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
                <p className="font-body text-xs text-muted-foreground mt-2">
                  We'll skip the reminder on days you've already captured a memory.
                </p>
              </div>
              <button
                onClick={handleSendTest}
                disabled={sendingTest}
                className="mt-3 w-full py-2 rounded-xl border border-border bg-background font-body text-xs font-medium text-foreground flex items-center justify-center gap-2 hover:bg-secondary transition-colors disabled:opacity-60">
                {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                {sendingTest ? "Sending…" : "Send test notification"}
              </button>
            </>
          )}
        </motion.div>

        {/* Download Memories */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl shadow-card p-5">
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
            className="w-full py-2.5 rounded-xl border border-border bg-background font-body text-sm font-medium text-foreground flex items-center justify-center gap-2 hover:bg-secondary transition-colors disabled:opacity-60">
            {downloading ?
            <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing download…
              </> :
            <>
                <Download className="w-4 h-4" />
                Download all memories
              </>
            }
          </button>
        </motion.div>

        {/* Sign Out */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}>
          <button
            onClick={signOut}
            className="w-full py-3 rounded-xl border border-border bg-card font-body text-sm font-medium text-destructive flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors shadow-card">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="pt-4">
          <p className="font-body text-xs text-muted-foreground mb-2 uppercase tracking-wider">Danger zone</p>
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="w-full py-3 rounded-xl border border-destructive/30 bg-card font-body text-sm font-medium text-destructive flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors">
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
              className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-destructive/30 disabled:opacity-60" />
          </div>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel disabled={deleting} className="flex-1 rounded-xl font-body text-sm">
              Cancel
            </AlertDialogCancel>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || deleting}
              className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground font-body text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? "Deleting…" : "Delete forever"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Broadcast Confirmation Dialog */}
      <AlertDialog open={bcConfirmOpen} onOpenChange={(open) => {
        if (!bcSending) {
          setBcConfirmOpen(open);
          if (!open) setBcConfirmText("");
        }
      }}>
        <AlertDialogContent className="rounded-2xl max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg text-foreground">Send this broadcast?</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-sm text-muted-foreground">
              Audience: <strong className="text-foreground">
                {bcAudience === "all_enabled" ? "All users with reminders ON" :
                 bcAudience === "all_subscriptions" ? "All push subscriptions" : "Just me"}
              </strong>
              {bcRecipients !== null && <> · {bcRecipients} device{bcRecipients === 1 ? "" : "s"}</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="font-display text-sm font-bold text-foreground">{bcTitle}</p>
            <p className="font-body text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{bcBody}</p>
          </div>
          <div className="py-1">
            <label className="font-body text-xs text-muted-foreground block mb-1.5">
              Type <strong className="text-foreground">SEND</strong> to confirm
            </label>
            <input
              type="text"
              value={bcConfirmText}
              onChange={(e) => setBcConfirmText(e.target.value)}
              placeholder="SEND"
              disabled={bcSending}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
          </div>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel disabled={bcSending} className="flex-1 rounded-xl font-body text-sm">
              Cancel
            </AlertDialogCancel>
            <button
              onClick={handleBcSend}
              disabled={bcConfirmText !== "SEND" || bcSending}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-body text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity">
              {bcSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {bcSending ? "Sending…" : "Send now"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}

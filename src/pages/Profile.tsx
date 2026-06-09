import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { LogOut, Download, Crown, ArrowLeft, Loader2, Check, User, Trash2, Flame, MapPin, Sun, Moon, Smartphone, Shield } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { ThemePreference } from "@/lib/theme";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
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
const MemoryMap = lazy(() => import("@/components/MemoryMap"));

interface MemoryLocation {
  date: string;
  note: string | null;
  latitude: number;
  longitude: number;
}


export default function Profile() {
  const { user, signOut, subscribed, isTrialing, trialDaysLeft, subscriptionEnd, checkSubscription, subscriptionLoading } = useAuth();
  const navigate = useNavigate();
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();

  const [downloading, setDownloading] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const ADMIN_USER_IDS = new Set<string>(["123f18ad-9a45-4dcb-9527-61cb2be423d0"]);
  const isAdmin = !!user && ADMIN_USER_IDS.has(user.id);

  const { streak, locations } = useMemories();



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

        {/* Admin dashboard link */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.09 }}
          >
            <button
              onClick={() => navigate("/admin")}
              className="w-full bg-card rounded-2xl shadow-card p-4 border border-primary/30 flex items-center gap-3 hover:bg-secondary/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-display text-sm font-bold text-foreground">
                  Admin dashboard
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  Metrics, users, revenue, broadcasts
                </p>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
            </button>
          </motion.div>
        )}


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

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="bg-card rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sun className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm font-bold text-foreground">Appearance</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 p-1 bg-secondary rounded-xl">
            {([
              { value: "light", label: "Light", Icon: Sun },
              { value: "dark", label: "Dark", Icon: Moon },
              { value: "system", label: "Device", Icon: Smartphone },
            ] as { value: ThemePreference; label: string; Icon: typeof Sun }[]).map(({ value, label, Icon }) => {
              const active = themePreference === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setThemePreference(value)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg font-body text-xs font-medium transition-colors ${
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
          <p className="font-body text-xs text-muted-foreground mt-3">
            Device follows your phone's light or dark setting automatically.
          </p>
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

        <footer className="pt-6 pb-8 text-center space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-body text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <span aria-hidden>·</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <span aria-hidden>·</span>
            <Link to="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
            <span aria-hidden>·</span>
            <a href="mailto:hello@okiro.online" className="hover:text-foreground transition-colors">Contact</a>
          </div>
          <p className="font-body text-xs text-muted-foreground">
            © {new Date().getFullYear()} Okiro
          </p>
        </footer>
      </div>

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
              Audience: <strong className="text-foreground">All push subscribers</strong>
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

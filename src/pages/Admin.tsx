import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Users,
  Activity,
  CreditCard,
  Bell,
  Megaphone,
  Send,
  Download,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import StatCard from "@/components/admin/StatCard";

const PushPanel = lazy(() => import("@/components/AdminPanel"));

const ADMIN_USER_IDS = new Set<string>([
  "123f18ad-9a45-4dcb-9527-61cb2be423d0",
]);

type MetricsUser = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  memories: number;
  storage_bytes: number;
  subscription: { active: boolean; is_trialing: boolean };
};

type Metrics = {
  generated_at: string;
  totals: {
    users: number;
    new_users_7d: number;
    new_users_30d: number;
    memories: number;
    memories_7d: number;
    memories_30d: number;
    push_subscribers: number;
    active_subscriptions: number;
    trialing_subscriptions: number;
    storage_bytes: number;
  };
  activity: { dau: number; wau: number; mau: number };
  users: MetricsUser[];
};

type StripeMetrics = {
  active_count: number;
  trialing_count: number;
  mrr_cents: number;
  mrr_currency: string;
  canceled_7d: number;
  canceled_30d: number;
  new_paid_7d: number;
  new_paid_30d: number;
  churn_rate_30d: number;
  plans: { price_id: string; count: number; price: number; currency: string; nickname: string }[];
};

function fmtBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtMoney(cents: number, currency: string): string {
  if (currency === "mixed") return `${(cents / 100).toFixed(2)} (mixed)`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = !!user && ADMIN_USER_IDS.has(user.id);

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/profile", { replace: true });
  }, [loading, isAdmin, navigate]);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [stripeMetrics, setStripeMetrics] = useState<StripeMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingStripe, setLoadingStripe] = useState(false);

  const loadMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-metrics");
      if (error) throw error;
      setMetrics(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load metrics");
    } finally {
      setLoadingMetrics(false);
    }
  };

  const loadStripe = async () => {
    setLoadingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-stripe-metrics",
      );
      if (error) throw error;
      setStripeMetrics(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load revenue data");
    } finally {
      setLoadingStripe(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadMetrics();
      loadStripe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // ===== Tools state =====
  const [sendingTest, setSendingTest] = useState(false);
  const [bcTitle, setBcTitle] = useState("Okiro");
  const [bcBody, setBcBody] = useState("");
  const [bcUrl, setBcUrl] = useState("/");
  const [bcConfirmOpen, setBcConfirmOpen] = useState(false);
  const [bcConfirmText, setBcConfirmText] = useState("");
  const [bcSending, setBcSending] = useState(false);
  const [bcRecipients, setBcRecipients] = useState<number | null>(null);
  const [bcResult, setBcResult] = useState<{
    sent: number;
    failed: number;
    expired_cleaned: number;
  } | null>(null);

  // Migration state
  const [migConfirmOpen, setMigConfirmOpen] = useState(false);
  const [migConfirmText, setMigConfirmText] = useState("");
  const [migCandidates, setMigCandidates] = useState<number | null>(null);
  const [migRunning, setMigRunning] = useState(false);
  const [migResult, setMigResult] = useState<{
    candidates: number;
    migrated: number;
    failed: number;
  } | null>(null);

  const openMigrateConfirm = async () => {
    setMigCandidates(null);
    setMigConfirmOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "migrate-subscriptions",
        { body: { preview: true } },
      );
      if (error) throw error;
      setMigCandidates(data?.candidates ?? 0);
    } catch (e: any) {
      toast.error(e.message || "Could not preview migration");
    }
  };

  const handleMigrate = async () => {
    if (migConfirmText !== "MIGRATE") return;
    setMigRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "migrate-subscriptions",
      );
      if (error) throw error;
      setMigResult({
        candidates: data?.candidates ?? 0,
        migrated: data?.migrated ?? 0,
        failed: data?.failed ?? 0,
      });
      toast.success(
        `Migrated ${data?.migrated ?? 0} subscription${data?.migrated === 1 ? "" : "s"}.`,
      );
      setMigConfirmOpen(false);
      setMigConfirmText("");
    } catch (e: any) {
      toast.error(e.message || "Migration failed");
    } finally {
      setMigRunning(false);
    }
  };

  const handleSendTest = async () => {
    if (sendingTest) return;
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-test-notification",
      );
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success(
          `Test sent to ${data.sent} device${data.sent === 1 ? "" : "s"}.`,
        );
      } else {
        const reason = data?.results?.[0]?.reason || "Unknown error";
        toast.error(`Couldn't send test (${reason}).`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to send test");
    } finally {
      setSendingTest(false);
    }
  };

  const openBroadcastConfirm = async () => {
    if (!bcTitle.trim() || !bcBody.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setBcRecipients(null);
    setBcConfirmOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-broadcast", {
        body: { preview: true, audience: "all_subscriptions" },
      });
      if (error) throw error;
      setBcRecipients(data?.recipients ?? 0);
    } catch (e: any) {
      toast.error(e.message || "Could not preview audience");
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
          audience: "all_subscriptions",
        },
      });
      if (error) throw error;
      setBcResult({
        sent: data?.sent ?? 0,
        failed: data?.failed ?? 0,
        expired_cleaned: data?.expired_cleaned ?? 0,
      });
      toast.success(
        `Broadcast sent to ${data?.sent ?? 0} device${data?.sent === 1 ? "" : "s"}.`,
      );
      setBcConfirmOpen(false);
      setBcConfirmText("");
      setBcBody("");
    } catch (e: any) {
      toast.error(e.message || "Failed to send broadcast");
    } finally {
      setBcSending(false);
    }
  };

  const exportUsersCSV = () => {
    if (!metrics) return;
    const header = [
      "user_id",
      "email",
      "display_name",
      "created_at",
      "memories",
      "storage_mb",
      "subscription",
    ];
    const rows = metrics.users.map((u) => [
      u.user_id,
      u.email ?? "",
      (u.display_name ?? "").replace(/[",\n]/g, " "),
      u.created_at,
      u.memories,
      (u.storage_bytes / 1024 / 1024).toFixed(2),
      u.subscription.is_trialing
        ? "trial"
        : u.subscription.active
          ? "active"
          : "none",
    ]);
    const csv =
      [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `okiro-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const t = metrics?.totals;
  const a = metrics?.activity;

  return (
    <div className="h-screen bg-background flex flex-col max-w-3xl mx-auto overflow-hidden">
      <header className="shrink-0 px-6 pt-4 pb-3 border-b border-border">
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-bold text-foreground">
            Admin dashboard
          </h1>
          <button
            onClick={() => {
              loadMetrics();
              loadStripe();
            }}
            disabled={loadingMetrics || loadingStripe}
            className="p-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-60"
            aria-label="Refresh all"
          >
            {loadingMetrics || loadingStripe ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="push">Push</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
          </TabsList>

          {/* ============ OVERVIEW ============ */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-3"
            >
              <StatCard
                accent
                label="Total users"
                value={t?.users ?? "—"}
                sub={
                  t
                    ? `+${t.new_users_7d} this week · +${t.new_users_30d} this month`
                    : undefined
                }
              />
              <StatCard
                accent
                label="MRR"
                value={
                  stripeMetrics
                    ? fmtMoney(stripeMetrics.mrr_cents, stripeMetrics.mrr_currency)
                    : loadingStripe
                      ? "…"
                      : "—"
                }
                sub={
                  stripeMetrics
                    ? `${stripeMetrics.active_count} active subscriptions`
                    : undefined
                }
              />
              <StatCard
                accent
                label="Memories"
                value={t?.memories ?? "—"}
                sub={
                  t ? `+${t.memories_7d} in last 7d` : undefined
                }
              />
              <StatCard
                label="DAU"
                value={a?.dau ?? "—"}
                sub="captured today"
              />
              <StatCard
                label="WAU"
                value={a?.wau ?? "—"}
                sub="last 7 days"
              />
              <StatCard
                label="MAU"
                value={a?.mau ?? "—"}
                sub="last 30 days"
              />
              <StatCard
                label="Trials"
                value={t?.trialing_subscriptions ?? "—"}
                sub="in progress"
              />
              <StatCard
                label="Churn (30d)"
                value={
                  stripeMetrics
                    ? `${(stripeMetrics.churn_rate_30d * 100).toFixed(1)}%`
                    : "—"
                }
                sub={
                  stripeMetrics
                    ? `${stripeMetrics.canceled_30d} canceled`
                    : undefined
                }
              />
              <StatCard
                label="Storage used"
                value={t ? fmtBytes(t.storage_bytes) : "—"}
                sub={
                  t && t.users > 0
                    ? `${fmtBytes(t.storage_bytes / Math.max(1, t.users))} / user`
                    : undefined
                }
              />
              <StatCard
                label="Push subs"
                value={t?.push_subscribers ?? "—"}
                sub={
                  t
                    ? `${((t.push_subscribers / Math.max(1, t.users)) * 100).toFixed(0)}% of users`
                    : undefined
                }
              />
              <StatCard
                label="New paid (7d)"
                value={stripeMetrics?.new_paid_7d ?? "—"}
                sub={
                  stripeMetrics
                    ? `${stripeMetrics.new_paid_30d} last 30d`
                    : undefined
                }
              />
              <StatCard
                label="Avg memories/user"
                value={
                  t && t.users > 0
                    ? (t.memories / t.users).toFixed(1)
                    : "—"
                }
              />
            </motion.div>

            {metrics && (
              <p className="font-body text-[11px] text-muted-foreground text-center pt-2">
                Updated {new Date(metrics.generated_at).toLocaleString()}
              </p>
            )}
          </TabsContent>

          {/* ============ USERS ============ */}
          <TabsContent value="users" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="font-display text-sm font-bold text-foreground">
                  Recent users
                </h2>
              </div>
              <button
                onClick={exportUsersCSV}
                disabled={!metrics}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background font-body text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
            {loadingMetrics && !metrics ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : metrics?.users.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">No users yet.</p>
            ) : (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] font-body">
                    <thead className="bg-secondary/40 text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">User</th>
                        <th className="text-left font-medium px-2 py-2">Joined</th>
                        <th className="text-right font-medium px-2 py-2">Mem.</th>
                        <th className="text-right font-medium px-2 py-2">Storage</th>
                        <th className="text-left font-medium px-3 py-2">Plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics?.users.map((u) => (
                        <tr key={u.user_id} className="border-t border-border text-foreground">
                          <td className="px-3 py-2 max-w-[180px] truncate">
                            <div className="truncate">{u.email ?? u.display_name ?? u.user_id.slice(0, 8)}</div>
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-2 py-2 text-right">{u.memories}</td>
                          <td className="px-2 py-2 text-right text-muted-foreground">
                            {fmtBytes(u.storage_bytes)}
                          </td>
                          <td className="px-3 py-2">
                            {u.subscription.is_trialing ? (
                              <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-semibold">
                                Trial
                              </span>
                            ) : u.subscription.active ? (
                              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                                Active
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ============ PUSH ============ */}
          <TabsContent value="push" className="mt-4">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <PushPanel />
            </Suspense>
          </TabsContent>

          {/* ============ REVENUE ============ */}
          <TabsContent value="revenue" className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm font-bold text-foreground">
                Revenue
              </h2>
            </div>
            {loadingStripe && !stripeMetrics ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : !stripeMetrics ? (
              <p className="font-body text-sm text-muted-foreground">
                Revenue data unavailable.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard
                    accent
                    label="MRR"
                    value={fmtMoney(stripeMetrics.mrr_cents, stripeMetrics.mrr_currency)}
                  />
                  <StatCard
                    label="Active"
                    value={stripeMetrics.active_count}
                  />
                  <StatCard
                    label="Trialing"
                    value={stripeMetrics.trialing_count}
                  />
                  <StatCard
                    label="New paid (7d)"
                    value={stripeMetrics.new_paid_7d}
                    sub={`${stripeMetrics.new_paid_30d} last 30d`}
                  />
                  <StatCard
                    label="Canceled (7d)"
                    value={stripeMetrics.canceled_7d}
                    sub={`${stripeMetrics.canceled_30d} last 30d`}
                  />
                  <StatCard
                    label="Churn (30d)"
                    value={`${(stripeMetrics.churn_rate_30d * 100).toFixed(1)}%`}
                  />
                </div>

                {stripeMetrics.plans.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-4">
                    <h3 className="font-body text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                      Active subscribers by plan
                    </h3>
                    <div className="space-y-1.5">
                      {stripeMetrics.plans.map((p) => (
                        <div
                          key={p.price_id}
                          className="flex items-center justify-between font-body text-xs"
                        >
                          <span className="text-foreground truncate">
                            {p.nickname || p.price_id}
                          </span>
                          <span className="text-muted-foreground">
                            {p.count} ·{" "}
                            {fmtMoney(p.price, p.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ============ TOOLS ============ */}
          <TabsContent value="tools" className="mt-4 space-y-4">
            {/* Broadcast */}
            <div className="bg-card rounded-2xl shadow-card p-5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="w-4 h-4 text-primary" />
                <h2 className="font-display text-sm font-bold text-foreground">
                  Broadcast push
                </h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">
                    Title
                  </label>
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
                    Body{" "}
                    <span className="text-muted-foreground/70">
                      ({bcBody.length}/200)
                    </span>
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
                  <label className="font-body text-xs text-muted-foreground block mb-1">
                    Open URL when tapped
                  </label>
                  <input
                    type="text"
                    value={bcUrl}
                    onChange={(e) => setBcUrl(e.target.value)}
                    placeholder="/"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <button
                  onClick={openBroadcastConfirm}
                  className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-body text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send to all push subscribers
                </button>
                {bcResult && (
                  <p className="font-body text-xs text-muted-foreground">
                    Last send:{" "}
                    <strong className="text-foreground">
                      {bcResult.sent} delivered
                    </strong>
                    , {bcResult.failed} failed, {bcResult.expired_cleaned}{" "}
                    expired cleaned.
                  </p>
                )}
              </div>
            </div>

            {/* Test push */}
            <div className="bg-card rounded-2xl shadow-card p-5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-primary" />
                <h2 className="font-display text-sm font-bold text-foreground">
                  Test push
                </h2>
              </div>
              <button
                onClick={handleSendTest}
                disabled={sendingTest}
                className="w-full py-2 rounded-xl border border-border bg-background font-body text-xs font-medium text-foreground flex items-center justify-center gap-2 hover:bg-secondary transition-colors disabled:opacity-60"
              >
                {sendingTest ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
                {sendingTest ? "Sending…" : "Send test to my devices"}
              </button>
            </div>

            {/* Migrate subs */}
            <div className="bg-card rounded-2xl shadow-card p-5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <h2 className="font-display text-sm font-bold text-foreground">
                  Migrate weekly → monthly
                </h2>
              </div>
              <p className="font-body text-xs text-muted-foreground mb-3">
                Switches all active weekly subscribers to the new 28 NOK/month
                plan. Stripe applies prorated credits automatically; no immediate
                charge.
              </p>
              <button
                onClick={openMigrateConfirm}
                className="w-full py-2 rounded-xl border border-border bg-background font-body text-xs font-medium text-foreground flex items-center justify-center gap-2 hover:bg-secondary transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Preview & migrate
              </button>
              {migResult && (
                <p className="font-body text-xs text-muted-foreground mt-2">
                  Last run:{" "}
                  <strong className="text-foreground">
                    {migResult.migrated} migrated
                  </strong>
                  , {migResult.failed} failed (of {migResult.candidates}).
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Broadcast confirmation */}
      <AlertDialog
        open={bcConfirmOpen}
        onOpenChange={(open) => {
          if (!bcSending) {
            setBcConfirmOpen(open);
            if (!open) setBcConfirmText("");
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg text-foreground">
              Send this broadcast?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body text-sm text-muted-foreground">
              Audience:{" "}
              <strong className="text-foreground">All push subscribers</strong>
              {bcRecipients !== null && (
                <>
                  {" "}
                  · {bcRecipients} device{bcRecipients === 1 ? "" : "s"}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="font-display text-sm font-bold text-foreground">
              {bcTitle}
            </p>
            <p className="font-body text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
              {bcBody}
            </p>
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
            <AlertDialogCancel
              disabled={bcSending}
              className="flex-1 rounded-xl font-body text-sm"
            >
              Cancel
            </AlertDialogCancel>
            <button
              onClick={handleBcSend}
              disabled={bcConfirmText !== "SEND" || bcSending}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-body text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
            >
              {bcSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {bcSending ? "Sending…" : "Send now"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

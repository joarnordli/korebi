import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, RefreshCw, Loader2, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ReminderRun = {
  id: string;
  run_at: string;
  total_subscriptions: number;
  eligible: number;
  sent: number;
  skipped_already_captured: number;
  failed: number;
  expired_cleaned: number;
  duration_ms: number;
};
type EngagementRun = {
  id: string;
  run_at: string;
  total_users: number;
  streak_sent: number;
  comeback_sent: number;
  recap_sent: number;
  failed: number;
};
type Broadcast = {
  id: string;
  created_at: string;
  title: string;
  audience: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
};
type SendEvent = {
  source: string;
  sent_at: string;
  opened_at: string | null;
  title: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pct(opened: number, sent: number) {
  if (sent === 0) return "—";
  return `${Math.round((opened / sent) * 1000) / 10}%`;
}

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [reminderRuns, setReminderRuns] = useState<ReminderRun[]>([]);
  const [engagementRuns, setEngagementRuns] = useState<EngagementRun[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [events, setEvents] = useState<SendEvent[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
      const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

      const [rRuns, eRuns, bcasts, evts] = await Promise.all([
        supabase
          .from("reminder_run_log")
          .select("*")
          .gte("run_at", since24h)
          .order("run_at", { ascending: false })
          .limit(50),
        supabase
          .from("engagement_run_log")
          .select("*")
          .gte("run_at", since7d)
          .order("run_at", { ascending: false })
          .limit(100),
        supabase
          .from("broadcast_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("push_send_events")
          .select("source, sent_at, opened_at, title")
          .gte("sent_at", since30d)
          .order("sent_at", { ascending: false })
          .limit(5000),
      ]);

      if (rRuns.error) throw rRuns.error;
      if (eRuns.error) throw eRuns.error;
      if (bcasts.error) throw bcasts.error;
      if (evts.error) throw evts.error;

      setReminderRuns((rRuns.data ?? []) as ReminderRun[]);
      setEngagementRuns((eRuns.data ?? []) as EngagementRun[]);
      setBroadcasts((bcasts.data ?? []) as Broadcast[]);
      setEvents((evts.data ?? []) as SendEvent[]);
    } catch (err) {
      const msg = (err as Error).message ?? "Failed to load admin data";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ===== Aggregations for "Push performance" =====
  const bySource = new Map<string, { sent: number; opened: number }>();
  for (const e of events) {
    const cur = bySource.get(e.source) ?? { sent: 0, opened: 0 };
    cur.sent++;
    if (e.opened_at) cur.opened++;
    bySource.set(e.source, cur);
  }
  const sourceStats = Array.from(bySource.entries())
    .map(([source, s]) => ({ source, ...s, rate: s.sent > 0 ? s.opened / s.sent : 0 }))
    .sort((a, b) => b.rate - a.rate);

  // 14-day reminder open-rate sparkline data
  const days: { day: string; sent: number; opened: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    days.push({ day: d.toISOString().slice(0, 10), sent: 0, opened: 0 });
  }
  const dayMap = new Map(days.map((d) => [d.day, d]));
  for (const e of events) {
    if (e.source !== "reminder") continue;
    const day = e.sent_at.slice(0, 10);
    const bucket = dayMap.get(day);
    if (!bucket) continue;
    bucket.sent++;
    if (e.opened_at) bucket.opened++;
  }
  const maxRate = Math.max(0.0001, ...days.map((d) => (d.sent > 0 ? d.opened / d.sent : 0)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-card rounded-2xl shadow-card p-5 border border-primary/20 space-y-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm font-bold text-foreground">Admin · Push insights</h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-60"
          aria-label="Refresh"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Per-source open rates */}
      <section>
        <h3 className="font-body text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
          Open rate by source · last 30 days
        </h3>
        {sourceStats.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground">No sends recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {sourceStats.map((s) => (
              <div key={s.source} className="flex items-center gap-3">
                <span className="font-body text-xs text-foreground capitalize w-24 shrink-0">
                  {s.source}
                </span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.round(s.rate * 100)}%` }}
                  />
                </div>
                <span className="font-body text-xs text-muted-foreground w-24 text-right">
                  {pct(s.opened, s.sent)} · {s.opened}/{s.sent}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reminder open-rate sparkline */}
      <section>
        <h3 className="font-body text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
          Reminder open rate · last 14 days
        </h3>
        <div className="flex items-end gap-1 h-16">
          {days.map((d) => {
            const r = d.sent > 0 ? d.opened / d.sent : 0;
            const h = Math.max(2, Math.round((r / maxRate) * 56));
            return (
              <div
                key={d.day}
                className="flex-1 bg-primary/70 rounded-t"
                style={{ height: `${h}px` }}
                title={`${d.day} · ${pct(d.opened, d.sent)} (${d.opened}/${d.sent})`}
              />
            );
          })}
        </div>
        <div className="flex justify-between font-body text-[10px] text-muted-foreground mt-1">
          <span>{days[0].day.slice(5)}</span>
          <span>{days[days.length - 1].day.slice(5)}</span>
        </div>
      </section>

      {/* Top broadcasts */}
      {broadcasts.length > 0 && (
        <section>
          <h3 className="font-body text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
            Recent broadcasts
          </h3>
          <div className="space-y-1.5">
            {broadcasts.slice(0, 5).map((b) => {
              // Approx open rate from events for this broadcast title (best-effort match)
              const matched = events.filter(
                (e) => e.source === "broadcast" && e.title === b.title,
              );
              const opens = matched.filter((e) => e.opened_at).length;
              return (
                <div key={b.id} className="flex items-center gap-2 text-xs">
                  <span className="font-body text-foreground truncate flex-1" title={b.title}>
                    {b.title}
                  </span>
                  <span className="font-body text-muted-foreground shrink-0">
                    {b.sent_count} sent · {opens > 0 ? pct(opens, matched.length) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reminder runs */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="font-body text-xs font-semibold text-foreground uppercase tracking-wider">
            Reminder runs · last 24h
          </h3>
        </div>
        {reminderRuns.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground">No runs in the last 24h.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[11px] font-body">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-1 py-1">When</th>
                  <th className="text-right font-medium px-1 py-1">Elig</th>
                  <th className="text-right font-medium px-1 py-1">Sent</th>
                  <th className="text-right font-medium px-1 py-1">Skip</th>
                  <th className="text-right font-medium px-1 py-1">Fail</th>
                </tr>
              </thead>
              <tbody>
                {reminderRuns.slice(0, 12).map((r) => (
                  <tr key={r.id} className="text-foreground">
                    <td className="px-1 py-1">{formatTime(r.run_at)}</td>
                    <td className="px-1 py-1 text-right">{r.eligible}</td>
                    <td className="px-1 py-1 text-right">{r.sent}</td>
                    <td className="px-1 py-1 text-right">{r.skipped_already_captured}</td>
                    <td className="px-1 py-1 text-right">{r.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Engagement runs */}
      <section>
        <h3 className="font-body text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
          Engagement runs · last 7d (only with sends)
        </h3>
        {(() => {
          const withSends = engagementRuns.filter(
            (r) => r.streak_sent + r.comeback_sent + r.recap_sent > 0,
          );
          if (withSends.length === 0) {
            return (
              <p className="font-body text-xs text-muted-foreground">
                No engagement pushes sent in the last 7 days.
              </p>
            );
          }
          return (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[11px] font-body">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-1 py-1">When</th>
                    <th className="text-right font-medium px-1 py-1">Streak</th>
                    <th className="text-right font-medium px-1 py-1">Comeback</th>
                    <th className="text-right font-medium px-1 py-1">Recap</th>
                  </tr>
                </thead>
                <tbody>
                  {withSends.slice(0, 12).map((r) => (
                    <tr key={r.id} className="text-foreground">
                      <td className="px-1 py-1">{formatTime(r.run_at)}</td>
                      <td className="px-1 py-1 text-right">{r.streak_sent}</td>
                      <td className="px-1 py-1 text-right">{r.comeback_sent}</td>
                      <td className="px-1 py-1 text-right">{r.recap_sent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </section>
    </motion.div>
  );
}

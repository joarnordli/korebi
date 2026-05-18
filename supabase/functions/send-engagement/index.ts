import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- VAPID helpers (mirrors send-reminders) ----------
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function vapidKeysToJWK(pub: string, priv: string) {
  const pubBytes = base64urlDecode(pub);
  return {
    kty: "EC",
    crv: "P-256",
    x: base64urlEncode(pubBytes.slice(1, 33)),
    y: base64urlEncode(pubBytes.slice(33, 65)),
    d: priv,
  };
}

// ---------- Time helpers ----------
function getCurrentHourInTimezone(tz: string): number {
  try {
    return parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date()),
      10,
    );
  } catch { return -1; }
}
function getTodayInTimezone(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch { return new Date().toISOString().slice(0, 10); }
}
function getDayOfMonthInTimezone(tz: string): number {
  return parseInt(getTodayInTimezone(tz).slice(8, 10), 10);
}
function daysBetween(a: string, b: string): number {
  // a, b are YYYY-MM-DD; returns b - a in days
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86_400_000);
}
function computeStreak(dates: string[], today: string): number {
  // dates: descending unique YYYY-MM-DD. Streak counts consecutive days
  // ending yesterday or today.
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  let streak = 0;
  // Anchor: if captured today, start at today, else at yesterday
  let cursor = set.has(today)
    ? today
    : new Date(new Date(today + "T00:00:00Z").getTime() - 86_400_000).toISOString().slice(0, 10);
  while (set.has(cursor)) {
    streak++;
    cursor = new Date(new Date(cursor + "T00:00:00Z").getTime() - 86_400_000).toISOString().slice(0, 10);
  }
  return streak;
}

// ---------- Message builders ----------
function streakMessage(streak: number): { title: string; body: string } {
  const variants: { title: string; body: string }[] = [
    { title: `🔥 ${streak}-day streak alive`, body: `One photo away from day ${streak + 1}.` },
    { title: "Keep the chain going ✨", body: `You're ${streak} days in — don't stop now.` },
    { title: `Day ${streak + 1} is calling 📸`, body: "Snap today to extend your streak." },
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}
const comebackMessages: { title: string; body: string }[] = [
  { title: "We saved your spot 🤍", body: "Pick up where you left off." },
  { title: "Long time, no frame 💭", body: "What's worth remembering today?" },
  { title: "Your shelf misses you 🎞️", body: "One photo and you're back." },
];
function monthName(monthIdx: number): string {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][monthIdx];
}

// ---------- Main ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPub || !vapidPriv) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const privateJWK = vapidKeysToJWK(vapidPub, vapidPriv);

    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("reminder_enabled", true);
    if (subsErr) throw subsErr;

    const total = subs?.length ?? 0;
    if (!subs || total === 0) {
      await supabase.from("engagement_run_log").insert({
        total_users: 0, streak_sent: 0, comeback_sent: 0, recap_sent: 0,
        failed: 0, expired_cleaned: 0, duration_ms: Date.now() - startedAt,
      });
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group subscriptions by user
    const byUser = new Map<string, typeof subs>();
    for (const s of subs) {
      const arr = byUser.get(s.user_id) ?? [];
      arr.push(s);
      byUser.set(s.user_id, arr);
    }
    const userIds = Array.from(byUser.keys());

    // Pull last 60 days of memories for streak/comeback math
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
    const { data: mems } = await supabase
      .from("memories")
      .select("user_id, date")
      .in("user_id", userIds)
      .gte("date", sixtyDaysAgo);

    const userDates = new Map<string, string[]>();
    (mems ?? []).forEach((m: { user_id: string; date: string }) => {
      const arr = userDates.get(m.user_id) ?? [];
      arr.push(m.date);
      userDates.set(m.user_id, arr);
    });

    // Pull recent engagement sends (last 30 days) for cooldowns
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: recentSends } = await supabase
      .from("engagement_sends")
      .select("user_id, trigger, sent_at")
      .in("user_id", userIds)
      .gte("sent_at", thirtyDaysAgo);

    const sendsByUser = new Map<string, { trigger: string; sent_at: string }[]>();
    (recentSends ?? []).forEach((r) => {
      const arr = sendsByUser.get(r.user_id) ?? [];
      arr.push({ trigger: r.trigger, sent_at: r.sent_at });
      sendsByUser.set(r.user_id, arr);
    });

    let streakSent = 0, comebackSent = 0, recapSent = 0, failed = 0;
    const expiredIds: string[] = [];

    // Process each user — pick at most ONE trigger per run (and per day)
    for (const [userId, userSubs] of byUser) {
      // Use first sub's tz/window as user representative
      const repr = userSubs[0];
      const tz = repr.timezone ?? "UTC";
      const today = getTodayInTimezone(tz);
      const hour = getCurrentHourInTimezone(tz);
      const windowStart = repr.reminder_window_start ?? 10;
      const windowEnd = repr.reminder_window_end ?? 21;
      const dayOfMonth = getDayOfMonthInTimezone(tz);

      // Daily cap: skip if any engagement sent today, or reminder already sent today
      const sends = sendsByUser.get(userId) ?? [];
      const sentToday = sends.some((s) => s.sent_at.slice(0, 10) === today);
      const reminderToday = userSubs.some((s) => s.last_sent_date === today);
      if (sentToday || reminderToday) continue;

      const dates = (userDates.get(userId) ?? []).sort().reverse();
      const capturedToday = dates.includes(today);
      if (capturedToday) continue;

      // Decide trigger
      let chosen: { trigger: "streak" | "comeback" | "recap"; title: string; body: string; url: string } | null = null;

      // 1. Monthly recap: on 1st of month, ~windowStart hour, once per month
      if (dayOfMonth === 1 && hour === windowStart) {
        const lastRecap = sends.find((s) => s.trigger === "recap");
        const recapThisMonth = lastRecap && lastRecap.sent_at.slice(0, 7) === today.slice(0, 7);
        if (!recapThisMonth) {
          // Recap is for previous month
          const d = new Date(today + "T00:00:00Z");
          d.setUTCDate(0); // last day of previous month
          chosen = {
            trigger: "recap",
            title: `Your ${monthName(d.getUTCMonth())} recap is ready 🎞️`,
            body: "Tap to relive last month, one frame at a time.",
            url: `/?month=${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
          };
        }
      }

      // 2. Streak nudge: 3+ day streak, hasn't captured today, evening cutoff hour, cooldown 1 day
      if (!chosen && hour === windowEnd) {
        const streak = computeStreak(dates, today);
        if (streak >= 3) {
          const lastStreak = sends.find((s) => s.trigger === "streak");
          const lastStreakDays = lastStreak ? daysBetween(lastStreak.sent_at.slice(0, 10), today) : 999;
          if (lastStreakDays >= 1) {
            chosen = {
              trigger: "streak",
              title: "Okiro",
              body: streakMessage(streak),
              url: "/",
            };
          }
        }
      }

      // 3. Comeback: 3+ days inactive, mid-window hour, cooldown 7 days
      if (!chosen) {
        const midHour = Math.floor((windowStart + windowEnd) / 2);
        if (hour === midHour) {
          const lastDate = dates[0];
          const inactiveDays = lastDate ? daysBetween(lastDate, today) : 999;
          if (inactiveDays >= 3 && inactiveDays < 60) {
            const lastComeback = sends.find((s) => s.trigger === "comeback");
            const lastComebackDays = lastComeback ? daysBetween(lastComeback.sent_at.slice(0, 10), today) : 999;
            if (lastComebackDays >= 7) {
              chosen = {
                trigger: "comeback",
                title: "Okiro",
                body: comebackMessages[Math.floor(Math.random() * comebackMessages.length)],
                url: "/",
              };
            }
          }
        }
      }

      if (!chosen) continue;

      // Send to all of user's subscriptions
      let userSentOne = false;
      for (const sub of userSubs) {
        // Log send event per push for open attribution
        const { data: evt } = await supabase
          .from("push_send_events")
          .insert({
            user_id: userId,
            source: chosen.trigger,
            title: chosen.title,
            body: chosen.body,
          })
          .select("id")
          .single();
        const eventId = evt?.id as string | undefined;
        const sep = chosen.url.includes("?") ? "&" : "?";
        const eventUrl = eventId ? `${chosen.url}${sep}n=${eventId}` : chosen.url;

        try {
          const { endpoint, headers, body } = await buildPushHTTPRequest({
            privateJWK,
            subscription: {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            message: {
              payload: { title: chosen.title, body: chosen.body, url: eventUrl, eventId },
              adminContact: "mailto:hello@okiroapp.com",
            },
          });
          const res = await fetch(endpoint, { method: "POST", headers, body });
          if (res.ok || res.status === 201) {
            userSentOne = true;
            await supabase
              .from("push_subscriptions")
              .update({ last_sent_date: today })
              .eq("id", sub.id);
          } else if (res.status === 410 || res.status === 404) {
            expiredIds.push(sub.id);
            failed++;
          } else {
            failed++;
            console.error(`[SEND-ENGAGEMENT] Push failed user=${userId} status=${res.status}`);
          }
        } catch (e) {
          failed++;
          console.error(`[SEND-ENGAGEMENT] Error user=${userId}:`, e);
        }
      }

      if (userSentOne) {
        await supabase.from("engagement_sends").insert({
          user_id: userId,
          trigger: chosen.trigger,
          metadata: { body: chosen.body },
        });
        if (chosen.trigger === "streak") streakSent++;
        else if (chosen.trigger === "comeback") comebackSent++;
        else if (chosen.trigger === "recap") recapSent++;
        console.log(`[SEND-ENGAGEMENT] ${chosen.trigger} → ${userId}: ${chosen.body}`);
      }
    }

    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }

    const duration = Date.now() - startedAt;
    await supabase.from("engagement_run_log").insert({
      total_users: byUser.size,
      streak_sent: streakSent,
      comeback_sent: comebackSent,
      recap_sent: recapSent,
      failed,
      expired_cleaned: expiredIds.length,
      duration_ms: duration,
    });

    console.log(`[SEND-ENGAGEMENT] Done: users=${byUser.size} streak=${streakSent} comeback=${comebackSent} recap=${recapSent} failed=${failed} (${duration}ms)`);

    return new Response(
      JSON.stringify({
        users: byUser.size,
        streak_sent: streakSent,
        comeback_sent: comebackSent,
        recap_sent: recapSent,
        failed,
        expired_cleaned: expiredIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[SEND-ENGAGEMENT] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message ?? "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

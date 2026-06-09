import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.1";
import { requireCronOrServiceRole } from "../_shared/auth-cron.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HARD_MIN_HOUR = 0;
const HARD_MAX_HOUR = 23;

async function getRandomHourForUser(
  userId: string,
  dateStr: string,
  windowStart: number,
  windowEnd: number,
): Promise<number> {
  const data = new TextEncoder().encode(userId + dateStr);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const span = windowEnd - windowStart + 1;
  return windowStart + (hashArray[0] % span);
}

function getCurrentHourInTimezone(timezone: string): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(now), 10);
  } catch {
    return -1;
  }
}

function getTodayInTimezone(timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    return fmt.format(new Date()); // YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function vapidKeysToJWK(publicKeyBase64url: string, privateKeyBase64url: string) {
  const pubBytes = base64urlDecode(publicKeyBase64url);
  const x = base64urlEncode(pubBytes.slice(1, 33));
  const y = base64urlEncode(pubBytes.slice(33, 65));
  const d = privateKeyBase64url;
  return { kty: "EC", crv: "P-256", x, y, d };
}
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

const reminders: { title: string; body: string }[] = [
  { title: "Today, in one frame ✨", body: "What's worth holding onto from today?" },
  { title: "Psst… got a second? 📸", body: "One photo. One memory. That's it." },
  { title: "Future-you is watching 👀", body: "Leave them something to smile about." },
  { title: "Tiny ritual time 🌱", body: "Capture today before it slips away." },
  { title: "What did today look like? 🎞️", body: "One frame is all it takes." },
  { title: "Pause for a sec 🤍", body: "Snap the moment, then carry on." },
  { title: "Hey, quick one 💭", body: "What's the photo of your day?" },
  { title: "Don't let today disappear 🌙", body: "One picture is enough." },
  { title: "A moment, bottled 🫙", body: "Add today to your memory shelf." },
  { title: "Sunset check-in 🌇", body: "Catch today before it's gone." },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const unauthorized = await requireCronOrServiceRole(req);
  if (unauthorized) {
    return new Response(unauthorized.body, {
      status: unauthorized.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = Date.now();

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[SEND-REMINDERS] VAPID keys not configured");
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const privateJWK = vapidKeysToJWK(vapidPublicKey, vapidPrivateKey);

    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("reminder_enabled", true);

    if (error) throw error;

    const total = subscriptions?.length ?? 0;
    if (!subscriptions || total === 0) {
      console.log("[SEND-REMINDERS] No enabled subscriptions");
      await supabaseAdmin.from("reminder_run_log").insert({
        total_subscriptions: 0, eligible: 0, sent: 0,
        skipped_already_captured: 0, failed: 0, expired_cleaned: 0,
        duration_ms: Date.now() - startedAt,
      });
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine eligibility based on user's preferred window + tz + already-sent
    const eligibleChecks = await Promise.all(
      subscriptions.map(async (sub) => {
        const windowStart = Math.max(HARD_MIN_HOUR, sub.reminder_window_start ?? 10);
        const windowEnd = Math.min(HARD_MAX_HOUR, sub.reminder_window_end ?? 21);
        const userToday = getTodayInTimezone(sub.timezone);
        const currentHour = getCurrentHourInTimezone(sub.timezone);
        const targetHour = await getRandomHourForUser(sub.user_id, userToday, windowStart, windowEnd);
        const alreadySentToday = sub.last_sent_date === userToday;
        const eligible =
          currentHour >= targetHour &&
          currentHour <= windowEnd &&
          !alreadySentToday;
        return { sub, eligible, currentHour, targetHour, userToday, alreadySentToday, windowStart, windowEnd };
      })
    );

    const eligible = eligibleChecks.filter((e) => e.eligible);
    console.log(`[SEND-REMINDERS] ${eligible.length}/${total} eligible this hour`);

    // For eligible users, skip those who already captured today (one query, grouped by user)
    let skippedAlready = 0;
    const toSend: typeof eligible = [];
    if (eligible.length > 0) {
      // Build (user_id -> userToday) map and check memories table per-user.
      // Most users have a single tz/today, so a single IN-list query is efficient.
      const userIds = Array.from(new Set(eligible.map((e) => e.sub.user_id)));
      const { data: recentMemories } = await supabaseAdmin
        .from("memories")
        .select("user_id, date")
        .in("user_id", userIds);

      const captured = new Set<string>();
      (recentMemories ?? []).forEach((m: { user_id: string; date: string }) => {
        captured.add(`${m.user_id}|${m.date}`);
      });

      for (const e of eligible) {
        if (captured.has(`${e.sub.user_id}|${e.userToday}`)) {
          skippedAlready++;
          // Mark as sent so we don't keep re-checking each hour
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ last_sent_date: e.userToday })
            .eq("id", e.sub.id);
          console.log(`[SEND-REMINDERS] Skipping ${e.sub.user_id} — already captured ${e.userToday}`);
        } else {
          toSend.push(e);
        }
      }
    }

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    for (const e of toSend) {
      const sub = e.sub;
      const picked = reminders[Math.floor(Math.random() * reminders.length)];
      const title = picked.title;
      const message = picked.body;

      // Log send event up front for open attribution
      const { data: evt } = await supabaseAdmin
        .from("push_send_events")
        .insert({
          user_id: sub.user_id,
          source: "reminder",
          title,
          body: message,
        })
        .select("id")
        .single();
      const eventId = evt?.id as string | undefined;
      const url = eventId ? `/?n=${eventId}` : "/";

      try {
        const { endpoint, headers, body } = await buildPushHTTPRequest({
          privateJWK,
          subscription: {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message: {
            payload: { title, body: message, url, eventId },
            adminContact: "mailto:hello@okiroapp.com",
          },
        });

        const response = await fetch(endpoint, { method: "POST", headers, body });

        if (response.ok || response.status === 201) {
          sent++;
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ last_sent_date: e.userToday })
            .eq("id", sub.id);
          console.log(`[SEND-REMINDERS] Sent to ${sub.user_id} (status ${response.status})`);
        } else if (response.status === 410 || response.status === 404) {
          expiredIds.push(sub.id);
          failed++;
          console.log(`[SEND-REMINDERS] Subscription expired for ${sub.user_id} (status ${response.status})`);
        } else {
          const respText = await response.text().catch(() => "");
          console.error(`[SEND-REMINDERS] Push failed for ${sub.user_id}: status ${response.status} - ${respText}`);
          failed++;
        }
      } catch (e2) {
        console.error(`[SEND-REMINDERS] Error sending to ${sub.user_id}:`, e2);
        failed++;
      }
    }

    if (expiredIds.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
      console.log(`[SEND-REMINDERS] Cleaned up ${expiredIds.length} expired subscriptions`);
    }

    const duration = Date.now() - startedAt;
    await supabaseAdmin.from("reminder_run_log").insert({
      total_subscriptions: total,
      eligible: eligible.length,
      sent,
      skipped_already_captured: skippedAlready,
      failed,
      expired_cleaned: expiredIds.length,
      duration_ms: duration,
    });

    console.log(`[SEND-REMINDERS] Done: total=${total} eligible=${eligible.length} sent=${sent} skipped=${skippedAlready} failed=${failed} expired=${expiredIds.length} (${duration}ms)`);

    return new Response(
      JSON.stringify({
        total,
        eligible: eligible.length,
        sent,
        skipped_already_captured: skippedAlready,
        failed,
        expired_cleaned: expiredIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SEND-REMINDERS] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Failed to send reminders" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

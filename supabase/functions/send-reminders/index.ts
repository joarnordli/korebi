import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MIN_HOUR = 10;
const MAX_HOUR = 21;

async function getRandomHourForUser(userId: string, dateStr: string): Promise<number> {
  const data = new TextEncoder().encode(userId + dateStr);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return MIN_HOUR + (hashArray[0] % (MAX_HOUR - MIN_HOUR + 1));
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

// Convert raw VAPID keys (base64url) to JWK for PushForge
function vapidKeysToJWK(publicKeyBase64url: string, privateKeyBase64url: string) {
  // The public key is 65 bytes uncompressed: 0x04 || x (32 bytes) || y (32 bytes)
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

const messages = [
  "Time to capture today's moment ✨",
  "What's your photo of the day? 📸",
  "One photo, one memory. Go! 🌟",
  "Don't forget today's snapshot 📷",
  "Your future self will thank you 🙏",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    console.log("[SEND-REMINDERS] VAPID JWK prepared");

    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("reminder_enabled", true);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      console.log("[SEND-REMINDERS] No enabled subscriptions");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const eligibleChecks = await Promise.all(
      subscriptions.map(async (sub) => {
        const currentHour = getCurrentHourInTimezone(sub.timezone);
        const targetHour = await getRandomHourForUser(sub.user_id, today);
        return { sub, eligible: currentHour === targetHour, currentHour, targetHour };
      })
    );
    const eligible = eligibleChecks.filter((e) => e.eligible).map((e) => e.sub);

    console.log(`[SEND-REMINDERS] ${eligible.length}/${subscriptions.length} eligible this hour`);
    eligibleChecks.forEach((e) => {
      console.log(`[SEND-REMINDERS] User ${e.sub.user_id}: tz=${e.sub.timezone} currentHour=${e.currentHour}, targetHour=${e.targetHour}, eligible=${e.eligible}`);
    });

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    for (const sub of eligible) {
      const delay = Math.floor(Math.random() * 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));

      const message = messages[Math.floor(Math.random() * messages.length)];

      try {
        const { endpoint, headers, body } = await buildPushHTTPRequest({
          privateJWK,
          subscription: {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          message: {
            payload: {
              title: "Okiro",
              body: message,
              url: "/",
            },
            adminContact: "mailto:hello@okiroapp.com",
          },
        });

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body,
        });

        if (response.ok || response.status === 201) {
          sent++;
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
      } catch (e) {
        console.error(`[SEND-REMINDERS] Error sending to ${sub.user_id}:`, e);
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

    console.log(`[SEND-REMINDERS] Done: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ sent, failed, expired_cleaned: expiredIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SEND-REMINDERS] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send reminders" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

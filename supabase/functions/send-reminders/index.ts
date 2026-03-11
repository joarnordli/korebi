import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MIN_HOUR = 10; // 10 AM
const MAX_HOUR = 21; // 9 PM (last possible hour, so notifications arrive 10 AM – 9:59 PM)

// Deterministic random hour for a user on a given date
async function getRandomHourForUser(userId: string, dateStr: string): Promise<number> {
  const data = new TextEncoder().encode(userId + dateStr);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const value = hashArray[0]; // 0-255
  return MIN_HOUR + (value % (MAX_HOUR - MIN_HOUR + 1)); // 10-21
}

// Convert base64url to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Create a JWT for Web Push (VAPID)
async function createVapidJwt(
  audience: string,
  subject: string,
  publicKey: string,
  privateKeyBase64url: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const encode = (obj: unknown) => {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  // Import private key
  const privateKeyBytes = base64urlToUint8Array(privateKeyBase64url);
  const publicKeyBytes = base64urlToUint8Array(publicKey);

  // Build JWK for P-256
  const x = btoa(String.fromCharCode(...publicKeyBytes.slice(1, 33)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const y = btoa(String.fromCharCode(...publicKeyBytes.slice(33, 65)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const d = privateKeyBase64url;

  const jwk = { kty: "EC", crv: "P-256", x, y, d };
  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format if needed (Web Crypto returns raw for ECDSA)
  const sigBytes = new Uint8Array(signature);
  let sigBinary = "";
  for (const b of sigBytes) sigBinary += String.fromCharCode(b);
  const sigBase64url = btoa(sigBinary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${unsignedToken}.${sigBase64url}`;
}

// Send a single Web Push notification
async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; status: number }> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await createVapidJwt(audience, vapidSubject, vapidPublicKey, vapidPrivateKey);

  // Create encryption keys for Web Push (simplified: send plaintext payload)
  // For proper encryption we'd need ECDH + HKDF. Using raw push with VAPID auth.
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
    },
    body: new TextEncoder().encode(payload),
  });

  return { success: response.ok, status: response.status };
}

// Get current hour in a timezone
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
    return -1; // Invalid timezone
  }
}

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
    const vapidSubject = "mailto:hello@okiroapp.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[SEND-REMINDERS] VAPID keys not configured");
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all enabled subscriptions
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

    // Filter to users whose local time matches their deterministic random hour for today
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const eligibleChecks = await Promise.all(
      subscriptions.map(async (sub) => {
        const currentHour = getCurrentHourInTimezone(sub.timezone);
        const targetHour = await getRandomHourForUser(sub.user_id, today);
        return { sub, eligible: currentHour === targetHour };
      })
    );
    const eligible = eligibleChecks.filter((e) => e.eligible).map((e) => e.sub);

    console.log(`[SEND-REMINDERS] ${eligible.length}/${subscriptions.length} eligible this hour`);

    const messages = [
      "Time to capture today's moment ✨",
      "What's your photo of the day? 📸",
      "One photo, one memory. Go! 🌟",
      "Don't forget today's snapshot 📷",
      "Your future self will thank you 🙏",
    ];

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    for (const sub of eligible) {
      // Smart delivery: random delay 0-30 seconds
      const delay = Math.floor(Math.random() * 30000);
      await new Promise((resolve) => setTimeout(resolve, delay));

      const message = messages[Math.floor(Math.random() * messages.length)];
      const payload = JSON.stringify({
        title: "Okiro",
        body: message,
        url: "/",
      });

      try {
        const result = await sendPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        if (result.success) {
          sent++;
        } else if (result.status === 410 || result.status === 404) {
          // Subscription expired, mark for cleanup
          expiredIds.push(sub.id);
          failed++;
        } else {
          console.error(`[SEND-REMINDERS] Push failed for ${sub.id}: status ${result.status}`);
          failed++;
        }
      } catch (e) {
        console.error(`[SEND-REMINDERS] Error sending to ${sub.id}:`, e);
        failed++;
      }
    }

    // Clean up expired subscriptions
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

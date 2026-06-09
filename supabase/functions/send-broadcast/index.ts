import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Hardcoded admin allowlist. Server-side gate, not just UI.
const ADMIN_USER_IDS = new Set<string>([
  "123f18ad-9a45-4dcb-9527-61cb2be423d0",
]);

// Simple in-memory rate limiter (per cold start). Belt-and-suspenders alongside
// the typed-confirmation in the UI.
const lastSendByAdmin = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

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

type Audience = "all_enabled" | "all_subscriptions" | "self";

interface Body {
  title?: string;
  body?: string;
  url?: string;
  audience?: Audience;
  preview?: boolean; // if true, only count, do not send
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    if (!ADMIN_USER_IDS.has(userId)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json().catch(() => ({}))) as Body;
    const audience: Audience = payload.audience ?? "all_enabled";
    const preview = !!payload.preview;
    const url = (payload.url || "/").slice(0, 500);
    const title = (payload.title || "").trim();
    const body = (payload.body || "").trim();

    if (!preview) {
      if (!title || title.length > 80) {
        return new Response(JSON.stringify({ error: "Title is required (max 80 chars)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!body || body.length > 200) {
        return new Response(JSON.stringify({ error: "Body is required (max 200 chars)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const last = lastSendByAdmin.get(userId) ?? 0;
      if (Date.now() - last < RATE_LIMIT_MS) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a minute." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    let query = admin.from("push_subscriptions").select("*");
    if (audience === "self") query = query.eq("user_id", userId);
    // "all_subscriptions" (and legacy "all_enabled") => all rows, no filter


    const { data: subs, error: subsError } = await query;
    if (subsError) throw subsError;

    if (preview) {
      return new Response(
        JSON.stringify({ recipients: subs?.length ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients for this audience." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const privateJWK = vapidKeysToJWK(vapidPublicKey, vapidPrivateKey);

    lastSendByAdmin.set(userId, Date.now());

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    // Send in parallel with bounded concurrency to keep within timeouts
    const CONCURRENCY = 10;
    let idx = 0;
    async function worker() {
      while (idx < subs.length) {
        const i = idx++;
        const sub = subs[i];

        // Log send event up front for open attribution
        const { data: evt } = await admin
          .from("push_send_events")
          .insert({
            user_id: sub.user_id,
            source: "broadcast",
            title,
            body,
            metadata: { audience, sub_id: sub.id },
          })
          .select("id")
          .single();
        const eventId = evt?.id as string | undefined;
        const sep = url.includes("?") ? "&" : "?";
        const eventUrl = eventId ? `${url}${sep}n=${eventId}` : url;

        try {
          const { endpoint, headers, body: pushBody } = await buildPushHTTPRequest({
            privateJWK,
            subscription: {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            message: {
              payload: { title, body, url: eventUrl, eventId },
              adminContact: "mailto:hello@okiroapp.com",
            },
          });
          const response = await fetch(endpoint, { method: "POST", headers, body: pushBody });
          const respText = await response.text().catch(() => "");
          if (response.ok || response.status === 201) {
            sent++;
          } else if (response.status === 410 || response.status === 404) {
            expiredIds.push(sub.id);
            failed++;
          } else {
            failed++;
            console.warn(`[BROADCAST] sub=${sub.id} status=${response.status} ${respText.slice(0, 200)}`);
          }
        } catch (e) {
          failed++;
          console.error(`[BROADCAST] sub=${sub.id} error:`, e);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, subs.length) }, () => worker()));

    if (expiredIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", expiredIds);
    }

    await admin.from("broadcast_log").insert({
      sent_by: userId,
      title,
      body,
      url,
      audience,
      recipients_count: subs.length,
      sent_count: sent,
      failed_count: failed,
      expired_cleaned: expiredIds.length,
    });

    console.log(`[BROADCAST] admin=${userId} audience=${audience} recipients=${subs.length} sent=${sent} failed=${failed} expired=${expiredIds.length}`);

    return new Response(
      JSON.stringify({
        recipients: subs.length,
        sent,
        failed,
        expired_cleaned: expiredIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[BROADCAST] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

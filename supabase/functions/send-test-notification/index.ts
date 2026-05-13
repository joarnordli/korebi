import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const privateJWK = vapidKeysToJWK(vapidPublicKey, vapidPrivateKey);

    const { data: subs, error: subsError } = await admin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);
    if (subsError) throw subsError;
    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No push subscriptions found. Enable reminders first." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sent = 0;
    let failed = 0;
    const results: Array<{ id: string; status: number | string; reason?: string }> = [];
    const expiredIds: string[] = [];

    for (const sub of subs) {
      // Log a send-event row up front so we can attribute opens
      const { data: evt } = await admin
        .from("push_send_events")
        .insert({
          user_id: userId,
          source: "test",
          title: "Okiro test ✨",
          body: "If you see this, notifications are working!",
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
            payload: {
              title: "Okiro test ✨",
              body: "If you see this, notifications are working!",
              url,
              eventId,
            },
            adminContact: "mailto:hello@okiroapp.com",
          },
        });
        const response = await fetch(endpoint, { method: "POST", headers, body });
        const respText = await response.text().catch(() => "");
        if (response.ok || response.status === 201) {
          sent++;
          results.push({ id: sub.id, status: response.status });
        } else if (response.status === 410 || response.status === 404) {
          expiredIds.push(sub.id);
          failed++;
          results.push({ id: sub.id, status: response.status, reason: "expired" });
        } else {
          failed++;
          results.push({ id: sub.id, status: response.status, reason: respText.slice(0, 200) });
        }
        console.log(`[SEND-TEST] sub=${sub.id} status=${response.status} ${respText.slice(0, 200)}`);
      } catch (e) {
        failed++;
        results.push({ id: sub.id, status: "error", reason: (e as Error).message });
        console.error(`[SEND-TEST] sub=${sub.id} error=`, e);
      }
    }

    if (expiredIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", expiredIds);
    }

    return new Response(
      JSON.stringify({ sent, failed, expired_cleaned: expiredIds.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[SEND-TEST] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

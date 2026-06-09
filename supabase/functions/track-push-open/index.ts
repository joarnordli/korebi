import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Per-instance soft rate limit. Caps how many opens we'll forward for the
// same eventId in a rolling 60s window. Not a perfect defense against a
// distributed attacker (instance-local), but combined with the SQL-side
// `open_count < 50` clamp and 14-day window in `record_push_open`, it bounds
// total damage.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 5;
const recentOpens = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(eventId: string): boolean {
  const now = Date.now();
  const entry = recentOpens.get(eventId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    recentOpens.set(eventId, { count: 1, windowStart: now });
    // Occasional cheap GC so the map can't grow unbounded.
    if (recentOpens.size > 5000) {
      for (const [k, v] of recentOpens) {
        if (now - v.windowStart > RATE_WINDOW_MS) recentOpens.delete(k);
      }
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX_PER_WINDOW;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { eventId } = await req.json().catch(() => ({}));
    if (typeof eventId !== "string" || !UUID_RE.test(eventId)) {
      return new Response(JSON.stringify({ error: "Invalid eventId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isRateLimited(eventId)) {
      // Quietly succeed so attackers don't learn the threshold; just don't write.
      return new Response(JSON.stringify({ ok: true, throttled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { error } = await admin.rpc("record_push_open", { _event_id: eventId });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[TRACK-PUSH-OPEN] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

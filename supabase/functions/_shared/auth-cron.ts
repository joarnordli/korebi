// Shared auth guard for internal/cron-only edge functions.
// Allows the request if either:
//   - the `x-cron-secret` header matches the CRON_SECRET stored in Vault
//     (fetched once per cold start via the `get_cron_secret` RPC), or
//   - the `Authorization: Bearer <SERVICE_ROLE_KEY>` header is present
//     (so admins / manual re-runs from the dashboard still work).
//
// Returns null when the request is authorized, or a 401 Response otherwise.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

let cachedCronSecret: string | null = null;

async function getCronSecret(): Promise<string | null> {
  if (cachedCronSecret) return cachedCronSecret;
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin.rpc("get_cron_secret");
    if (error) {
      console.error("[auth-cron] get_cron_secret error:", error.message);
      return null;
    }
    if (typeof data === "string" && data.length > 0) {
      cachedCronSecret = data;
      return data;
    }
    return null;
  } catch (e) {
    console.error("[auth-cron] get_cron_secret threw:", e);
    return null;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function requireCronOrServiceRole(req: Request): Promise<Response | null> {
  const auth = req.headers.get("authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && auth === `Bearer ${serviceKey}`) return null;

  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  if (headerSecret) {
    const cronSecret = await getCronSecret();
    if (cronSecret && timingSafeEqual(headerSecret, cronSecret)) return null;
  }

  console.warn("[auth-cron] unauthorized request");
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

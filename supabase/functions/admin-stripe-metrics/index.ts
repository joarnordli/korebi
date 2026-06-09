import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: ud, error: ue } = await supabase.auth.getUser(token);
    if (ue || !ud.user) throw new Error("Not authenticated");
    const { data: ok } = await supabase.rpc("is_admin", { _user_id: ud.user.id });
    if (!ok) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Active subscriptions
    const active: Stripe.Subscription[] = [];
    let starting: string | undefined;
    for (let i = 0; i < 10; i++) {
      const page = await stripe.subscriptions.list({
        status: "active",
        limit: 100,
        starting_after: starting,
      });
      active.push(...page.data);
      if (!page.has_more) break;
      starting = page.data[page.data.length - 1].id;
    }

    // Trialing
    const trialingList = await stripe.subscriptions.list({
      status: "trialing",
      limit: 100,
    });
    const trialing = trialingList.data.length;

    // Canceled in last 30d
    const now = Math.floor(Date.now() / 1000);
    const since30 = now - 30 * 86400;
    const since7 = now - 7 * 86400;
    const canceledList = await stripe.subscriptions.list({
      status: "canceled",
      limit: 100,
      created: { gte: since30 },
    });
    const canceled30d = canceledList.data.filter(
      (s) => (s.canceled_at ?? 0) >= since30,
    ).length;
    const canceled7d = canceledList.data.filter(
      (s) => (s.canceled_at ?? 0) >= since7,
    ).length;

    // MRR (convert all to monthly, in cents of the price currency)
    let mrrCents = 0;
    const currencies = new Set<string>();
    const byPlan = new Map<string, { count: number; price: number; currency: string; nickname: string }>();
    for (const sub of active) {
      for (const item of sub.items.data) {
        const price = item.price;
        const qty = item.quantity ?? 1;
        const unit = price.unit_amount ?? 0;
        let monthly = unit;
        const interval = price.recurring?.interval;
        const count = price.recurring?.interval_count ?? 1;
        if (interval === "year") monthly = unit / (12 * count);
        else if (interval === "week") monthly = unit * (52 / 12) / count;
        else if (interval === "day") monthly = unit * (365 / 12) / count;
        else if (interval === "month") monthly = unit / count;
        mrrCents += monthly * qty;
        currencies.add(price.currency);
        const key = price.id;
        const cur = byPlan.get(key) ?? {
          count: 0,
          price: unit,
          currency: price.currency,
          nickname: price.nickname ?? (typeof price.product === "string" ? price.product : ""),
        };
        cur.count += 1;
        byPlan.set(key, cur);
      }
    }

    // New paid subs (created in window, not in trial)
    const newPaidList = await stripe.subscriptions.list({
      limit: 100,
      created: { gte: since30 },
    });
    const newPaid30d = newPaidList.data.filter((s) => s.status === "active").length;
    const newPaid7d = newPaidList.data.filter(
      (s) => s.status === "active" && s.created >= since7,
    ).length;

    const churnRate30d =
      active.length + canceled30d > 0
        ? canceled30d / (active.length + canceled30d)
        : 0;

    return new Response(
      JSON.stringify({
        generated_at: new Date().toISOString(),
        active_count: active.length,
        trialing_count: trialing,
        mrr_cents: Math.round(mrrCents),
        mrr_currency: currencies.size === 1 ? [...currencies][0] : "mixed",
        canceled_7d: canceled7d,
        canceled_30d: canceled30d,
        new_paid_7d: newPaid7d,
        new_paid_30d: newPaid30d,
        churn_rate_30d: churnRate30d,
        plans: Array.from(byPlan.entries()).map(([price_id, p]) => ({
          price_id,
          ...p,
        })),
      }),
      { headers: { ...cors, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

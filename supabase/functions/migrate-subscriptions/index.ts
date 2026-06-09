import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OLD_PRICE = "price_1T9OdhJZind3K83s4UfCsPtL";
const NEW_PRICE = "price_1TevL9JZind3K83svagyji0k";

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

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const preview = !!body.preview;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Collect active subs on the old weekly price (paginate).
    const candidates: { id: string; itemId: string; customer: string }[] = [];
    let starting: string | undefined;
    for (let i = 0; i < 20; i++) {
      const page = await stripe.subscriptions.list({
        status: "active",
        price: OLD_PRICE,
        limit: 100,
        starting_after: starting,
      });
      for (const s of page.data) {
        const item = s.items.data.find((it) => it.price.id === OLD_PRICE);
        if (item) {
          candidates.push({
            id: s.id,
            itemId: item.id,
            customer: typeof s.customer === "string" ? s.customer : s.customer.id,
          });
        }
      }
      if (!page.has_more) break;
      starting = page.data[page.data.length - 1]?.id;
    }

    if (preview) {
      return new Response(
        JSON.stringify({ preview: true, candidates: candidates.length }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 200 },
      );
    }

    let migrated = 0;
    let failed = 0;
    const failures: { id: string; error: string }[] = [];

    for (const c of candidates) {
      try {
        await stripe.subscriptions.update(c.id, {
          items: [{ id: c.itemId, price: NEW_PRICE }],
          proration_behavior: "create_prorations",
        });
        migrated++;
      } catch (e) {
        failed++;
        failures.push({
          id: c.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(
      JSON.stringify({
        candidates: candidates.length,
        migrated,
        failed,
        failures,
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

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CAMPAIGN_TAG = "billing-change-2026-06-v1";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input.toLowerCase().trim()),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
    const { data: ok } = await supabase.rpc("is_admin", {
      _user_id: ud.user.id,
    });
    if (!ok) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST"
      ? await req.json().catch(() => ({}))
      : {};
    const dryRun = !!body.dryRun;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Collect unique customer IDs from active + trialing subscriptions.
    const customerIds = new Set<string>();
    for (const status of ["active", "trialing"] as const) {
      let starting: string | undefined;
      for (let i = 0; i < 20; i++) {
        const page = await stripe.subscriptions.list({
          status,
          limit: 100,
          starting_after: starting,
        });
        for (const s of page.data) {
          const cid = typeof s.customer === "string"
            ? s.customer
            : s.customer.id;
          customerIds.add(cid);
        }
        if (!page.has_more) break;
        starting = page.data[page.data.length - 1]?.id;
      }
    }

    // Resolve emails. Dedupe by lowercase email.
    const emailToName = new Map<string, string | undefined>();
    for (const cid of customerIds) {
      try {
        const c = await stripe.customers.retrieve(cid);
        if ((c as Stripe.Customer).deleted) continue;
        const cust = c as Stripe.Customer;
        const email = cust.email?.toLowerCase().trim();
        if (!email) continue;
        if (!emailToName.has(email)) {
          emailToName.set(email, cust.name ?? undefined);
        }
      } catch {
        // skip
      }
    }

    const recipients = Array.from(emailToName.entries()).map(
      ([email, name]) => ({ email, name }),
    );

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          recipientCount: recipients.length,
          sampleEmails: recipients.slice(0, 5).map((r) => r.email),
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    let enqueued = 0;
    let failed = 0;
    const failures: { email: string; error: string }[] = [];

    for (const r of recipients) {
      const idKey = `${CAMPAIGN_TAG}-${await sha256Hex(r.email)}`;
      try {
        const { error } = await supabase.functions.invoke(
          "send-transactional-email",
          {
            body: {
              templateName: "billing-change-notice",
              recipientEmail: r.email,
              idempotencyKey: idKey,
              templateData: r.name ? { name: r.name } : {},
            },
          },
        );
        if (error) throw new Error(error.message || String(error));
        enqueued++;
      } catch (e) {
        failed++;
        failures.push({
          email: r.email,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(
      JSON.stringify({
        attempted: recipients.length,
        enqueued,
        failed,
        failures: failures.slice(0, 20),
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

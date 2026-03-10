import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

const FREE_TRIAL_DAYS = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    // Check free trial based on account creation date
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const trialDaysLeft = Math.max(0, Math.ceil(FREE_TRIAL_DAYS - daysSinceCreation));
    const inFreeTrial = daysSinceCreation < FREE_TRIAL_DAYS;

    logStep("Trial check", { daysSinceCreation: daysSinceCreation.toFixed(1), trialDaysLeft, inFreeTrial });

    if (inFreeTrial) {
      logStep("User is in free trial period");
      return new Response(
        JSON.stringify({
          subscribed: true,
          is_trialing: true,
          trial_days_left: trialDaysLeft,
          subscription_end: new Date(createdAt.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Free trial expired — check Stripe for active subscription
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found, trial expired");
      return new Response(
        JSON.stringify({ subscribed: false, trial_days_left: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    let sub = subscriptions.data[0];
    if (!sub) {
      const trialing = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
      sub = trialing.data[0];
    }

    if (!sub) {
      logStep("No active or trialing Stripe subscription, trial expired");
      return new Response(
        JSON.stringify({ subscribed: false, trial_days_left: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let subscriptionEnd: string | null = null;
    try {
      const endTimestamp = typeof sub.current_period_end === "number"
        ? sub.current_period_end
        : Number(sub.current_period_end);
      if (!isNaN(endTimestamp) && endTimestamp > 0) {
        subscriptionEnd = new Date(endTimestamp * 1000).toISOString();
      }
    } catch (e) {
      logStep("Warning: could not parse subscription end date");
    }

    logStep("Active Stripe subscription found", { status: sub.status, end: subscriptionEnd });

    return new Response(
      JSON.stringify({
        subscribed: true,
        is_trialing: sub.status === "trialing",
        trial_days_left: 0,
        subscription_end: subscriptionEnd,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

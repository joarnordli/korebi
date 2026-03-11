import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;

    console.log(`[DELETE-ACCOUNT] Starting deletion for user ${userId}`);

    // 1. Delete files from memories storage bucket
    try {
      const { data: files } = await supabaseAdmin.storage
        .from("memories")
        .list(userId);
      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${userId}/${f.name}`);
        await supabaseAdmin.storage.from("memories").remove(filePaths);
        console.log(`[DELETE-ACCOUNT] Deleted ${filePaths.length} files from storage`);
      }
    } catch (e) {
      console.error("[DELETE-ACCOUNT] Storage cleanup error (continuing):", e);
    }

    // 2. Delete database rows
    await supabaseAdmin.from("memories").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
    await supabaseAdmin.from("subscriptions").delete().eq("user_id", userId);
    console.log("[DELETE-ACCOUNT] Database rows deleted");

    // 3. Cancel Stripe subscription and delete customer
    try {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey && userEmail) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
        if (customers.data.length > 0) {
          const customer = customers.data[0];
          // Cancel all active subscriptions
          const subs = await stripe.subscriptions.list({ customer: customer.id, status: "active" });
          for (const sub of subs.data) {
            await stripe.subscriptions.cancel(sub.id);
          }
          // Also cancel trialing
          const trialSubs = await stripe.subscriptions.list({ customer: customer.id, status: "trialing" });
          for (const sub of trialSubs.data) {
            await stripe.subscriptions.cancel(sub.id);
          }
          // Delete the customer
          await stripe.customers.del(customer.id);
          console.log("[DELETE-ACCOUNT] Stripe customer deleted");
        }
      }
    } catch (e) {
      console.error("[DELETE-ACCOUNT] Stripe cleanup error (continuing):", e);
    }

    // 4. Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[DELETE-ACCOUNT] Auth deletion error:", deleteError);
      throw new Error("Failed to delete auth account");
    }
    console.log("[DELETE-ACCOUNT] Auth user deleted");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[DELETE-ACCOUNT] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to delete account" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

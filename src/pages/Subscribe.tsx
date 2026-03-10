import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import okiroLogo from "@/assets/okiro-logo.png";
import { LogOut, Crown, Loader2 } from "lucide-react";

export default function Subscribe() {
  const { signOut, checkSubscription, subscriptionLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast.success("Subscription activated! Welcome to Okiro.");
      checkSubscription();
      window.history.replaceState({}, "", "/subscribe");
    } else if (params.get("checkout") === "cancel") {
      toast.info("Checkout cancelled.");
      window.history.replaceState({}, "", "/subscribe");
    }
  }, [checkSubscription]);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="flex items-center gap-2 justify-center mb-6">
          <img src={okiroLogo} alt="Okiro" className="w-10 h-10" />
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
            Okiro
          </h1>
        </div>

        <div className="bg-card rounded-2xl shadow-card p-6 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground mb-2">
            Your free trial has ended
          </h2>
          <p className="font-body text-sm text-muted-foreground mb-6 leading-relaxed">
            We hope you enjoyed Okiro! Subscribe to keep capturing your daily moments and preserve all your memories.
          </p>

          <div className="bg-secondary rounded-xl p-4 mb-6">
            <p className="font-display text-2xl font-bold text-foreground">
              7 NOK<span className="font-body text-sm font-normal text-muted-foreground">/week</span>
            </p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              Tax included
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubscribe}
            disabled={loading || subscriptionLoading}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-semibold text-sm flex items-center justify-center gap-2 shadow-card disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Crown className="w-4 h-4" />
                Subscribe Now
              </>
            )}
          </motion.button>

          <button
            onClick={checkSubscription}
            className="w-full mt-3 py-2 font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Already subscribed? Refresh status
          </button>
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-2 mx-auto font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </motion.div>
    </div>
  );
}

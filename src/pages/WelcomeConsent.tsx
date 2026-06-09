import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import okiroLogo from "@/assets/okiro-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ConsentGate,
  useConsentState,
  writeConsent,
  CONSENT_TOS_VERSION,
} from "@/components/auth/ConsentGate";

export default function WelcomeConsent() {
  const navigate = useNavigate();
  const [consent, setConsent] = useConsentState();
  const [submitting, setSubmitting] = useState(false);

  // Bounce if not logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) navigate("/auth", { replace: true });
    });
  }, [navigate]);

  const canContinue = consent.age16 && consent.tos && !submitting;

  const handleSubmit = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("record-consent", {
        body: { age_confirmed: true, tos_accepted: true, tos_version: CONSENT_TOS_VERSION },
      });
      if (error) throw error;
      writeConsent();
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Could not record consent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    await supabase.auth.signOut();
    navigate("/welcome", { replace: true });
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-background flex flex-col items-center justify-center px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-2 justify-center mb-2">
          <img src={okiroLogo} alt="Okiro" className="w-8 h-8" />
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Okiro</h1>
        </div>
        <p className="font-body text-sm text-muted-foreground text-center mb-6">
          One more thing before you start.
        </p>

        <ConsentGate value={consent} onChange={setConsent} />

        <button
          onClick={handleSubmit}
          disabled={!canContinue}
          className="mt-5 w-full py-3 rounded-xl bg-primary text-primary-foreground font-body font-semibold text-sm disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
        <button
          onClick={handleDecline}
          className="mt-2 w-full py-2 font-body text-xs text-muted-foreground underline underline-offset-2"
        >
          Decline and sign out
        </button>
      </motion.div>
    </div>
  );
}

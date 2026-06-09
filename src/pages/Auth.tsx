import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import okiroLogo from "@/assets/okiro-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ConsentGate,
  useConsentState,
  writeConsent,
  CONSENT_TOS_VERSION,
} from "@/components/auth/ConsentGate";

const SIGNUP_INTENT_KEY = "okiro.signupIntent.v1";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useConsentState();

  // OAuth consent confirm dialog
  const [oauthDialog, setOauthDialog] = useState<null | "google" | "apple">(null);
  const [oauthConsent, setOauthConsent] = useConsentState();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !(consent.age16 && consent.tos)) {
      toast.error("Please confirm your age and accept the Terms.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              consent_tos_version: CONSENT_TOS_VERSION,
              consent_age_confirmed: true,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        writeConsent();
        try { sessionStorage.setItem(SIGNUP_INTENT_KEY, "1"); } catch { /* ignore */ }
        toast.success("Check your email to confirm your account!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startOAuth = async (provider: "google" | "apple") => {
    if (mode === "signup") {
      // Require explicit consent before redirecting
      setOauthConsent({ age16: false, tos: false });
      setOauthDialog(provider);
      return;
    }
    await doOAuth(provider);
  };

  const doOAuth = async (provider: "google" | "apple") => {
    try { sessionStorage.setItem(SIGNUP_INTENT_KEY, mode === "signup" ? "1" : "0"); } catch { /* ignore */ }
    if (mode === "signup") writeConsent();
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error(error.message);
  };

  const confirmOAuth = async () => {
    if (!oauthDialog) return;
    if (!(oauthConsent.age16 && oauthConsent.tos)) {
      toast.error("Please confirm both items to continue.");
      return;
    }
    const provider = oauthDialog;
    setOauthDialog(null);
    await doOAuth(provider);
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
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
            Okiro<span className="sr-only"> — One photo. One thought. Every day.</span>
          </h1>
        </div>
        <p className="font-body text-sm text-muted-foreground text-center mb-8">
          One photo. One thought. Every day.
        </p>

        <button
          onClick={() => startOAuth("google")}
          className="w-full py-3 rounded-xl border border-border bg-card font-body text-sm font-medium text-foreground flex items-center justify-center gap-3 hover:bg-secondary transition-colors mb-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <button
          onClick={() => startOAuth("apple")}
          className="w-full py-3 rounded-xl border border-border bg-foreground font-body text-sm font-medium text-background flex items-center justify-center gap-3 hover:opacity-90 transition-opacity mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Continue with Apple
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-body">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Your name"
                aria-label="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="password"
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {mode === "signup" && (
            <ConsentGate value={consent} onChange={setConsent} />
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading || (mode === "signup" && !(consent.age16 && consent.tos))}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-body font-semibold text-sm flex items-center justify-center gap-2 shadow-card disabled:opacity-60"
          >
            {loading ? "Please wait…" : (
              <>
                {mode === "login" ? "Sign in" : "Create account"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </form>

        <p className="text-center font-body text-sm text-muted-foreground mt-6">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-primary font-medium"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <div className="mt-10 pt-6 border-t border-border flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-body text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span aria-hidden>·</span>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span aria-hidden>·</span>
          <Link to="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
          <span aria-hidden>·</span>
          <a href="mailto:hello@okiro.online" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </motion.div>

      <Dialog open={!!oauthDialog} onOpenChange={(o) => !o && setOauthDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Before you continue</DialogTitle>
            <DialogDescription>
              We need a quick confirmation before signing you up with{" "}
              {oauthDialog === "google" ? "Google" : "Apple"}.
            </DialogDescription>
          </DialogHeader>
          <ConsentGate value={oauthConsent} onChange={setOauthConsent} id="oauth-consent" />
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOauthDialog(null)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!(oauthConsent.age16 && oauthConsent.tos)}
              onClick={confirmOAuth}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              Continue
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

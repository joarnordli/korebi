import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type State = "validating" | "ready" | "confirming" | "success" | "already" | "invalid" | "error";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("validating");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON_KEY },
        });
        const data = await res.json();
        if (!res.ok) {
          setState("invalid");
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState("already");
          return;
        }
        if (data.valid === true) {
          setState("ready");
          return;
        }
        setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("confirming");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) {
        setState("success");
      } else if (data?.reason === "already_unsubscribed") {
        setState("already");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <img src="/icon-192.png" alt="Okiro" className="w-14 h-14 mx-auto rounded-2xl" onError={(e) => ((e.currentTarget.style.display = "none"))} />
        <h1 className="font-display text-3xl">Unsubscribe</h1>

        {state === "validating" && (
          <p className="text-muted-foreground">Checking your link…</p>
        )}

        {state === "ready" && (
          <>
            <p className="text-muted-foreground">
              Click below to unsubscribe from Okiro emails. You'll no longer receive messages at this address.
            </p>
            <button
              onClick={confirm}
              className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state === "confirming" && (
          <p className="text-muted-foreground">Unsubscribing…</p>
        )}

        {state === "success" && (
          <p className="text-muted-foreground">
            You've been unsubscribed. Sorry to see you go.
          </p>
        )}

        {state === "already" && (
          <p className="text-muted-foreground">
            This email is already unsubscribed.
          </p>
        )}

        {state === "invalid" && (
          <p className="text-muted-foreground">
            This unsubscribe link is invalid or has expired.
          </p>
        )}

        {state === "error" && (
          <p className="text-muted-foreground">
            Something went wrong. Please try again later.
          </p>
        )}

        <Link to="/" className="inline-block text-sm text-muted-foreground underline">
          Back to Okiro
        </Link>
      </div>
    </main>
  );
}

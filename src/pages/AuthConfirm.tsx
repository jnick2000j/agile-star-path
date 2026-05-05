import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Landing page for the email-confirmation link sent during signup or after an
 * admin "Reset to Pending" action.
 *
 * The link puts a session into the URL/cookies. We:
 *   1. Mark the user's profile as `active` via reconcile_my_account_status RPC.
 *   2. Sign the user out so they MUST log in again with their normal flow.
 *   3. Show a success screen with a "Sign in" button.
 *
 * This deliberately separates email confirmation from logging in.
 */
export default function AuthConfirm() {
  const navigate = useNavigate();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The link delivers a session via implicit flow. Wait for it to land.
        await new Promise((r) => setTimeout(r, 200));
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          // Sometimes the URL contains an error
          const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const err = hash.get("error_description") || hash.get("error");
          if (err) {
            if (!cancelled) {
              setState("error");
              setMessage(decodeURIComponent(err));
            }
            return;
          }
        }

        // Mark account active (best-effort — trigger may have already done it).
        try {
          await supabase.rpc("reconcile_my_account_status");
        } catch (e) {
          console.warn("reconcile_my_account_status failed:", e);
        }

        // Now force them to log in fresh.
        await supabase.auth.signOut();

        if (!cancelled) setState("ok");
      } catch (e: any) {
        console.error("AuthConfirm failed:", e);
        if (!cancelled) {
          setState("error");
          setMessage(e?.message || "We couldn't confirm your email. Please try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md text-center space-y-5 rounded-2xl border border-border p-8 shadow-sm">
        {state === "working" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-semibold">Confirming your email…</h1>
            <p className="text-sm text-muted-foreground">Hang tight, this only takes a second.</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h1 className="text-xl font-semibold">Email confirmed</h1>
            <p className="text-sm text-muted-foreground">
              Your account is now active. Please sign in to continue.
            </p>
            <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
              Sign in
            </Button>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Confirmation failed</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/auth", { replace: true })}>
              Back to sign in
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

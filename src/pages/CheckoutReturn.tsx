import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const [confirming, setConfirming] = useState(true);

  useEffect(() => {
    // Webhook updates the subscription row asynchronously.
    // Give it a moment, then send the user to billing.
    const t = setTimeout(() => setConfirming(false), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        {confirming ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Confirming your subscription…</h1>
            <p className="text-sm text-muted-foreground">
              We're activating your plan. This only takes a moment.
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Payment received</h1>
            <p className="text-sm text-muted-foreground">
              Thanks! Your subscription is active.
            </p>
            {sessionId && (
              <p className="text-xs text-muted-foreground break-all">
                Reference: {sessionId}
              </p>
            )}
            <Button onClick={() => navigate("/billing")} className="w-full">
              Go to billing
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

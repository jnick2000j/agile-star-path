import { Lock, AlertTriangle, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";

interface SuspendedOrgBlockProps {
  reason?: string | null;
  kind?: string | null;
}

const KIND_LABELS: Record<string, string> = {
  non_payment: "Non-payment",
  admin_hold: "Administrative hold",
  policy_violation: "Policy violation",
  trial_expired: "Trial expired",
  manual: "Manual suspension",
};

export function SuspendedOrgBlock({ reason, kind }: SuspendedOrgBlockProps) {
  const { signOut } = useAuth();
  const { currentOrganization } = useOrganization();
  const kindLabel = kind ? KIND_LABELS[kind] ?? kind : "Suspended";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-lg w-full border-destructive/40">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto">
            <Lock className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-center text-2xl">Access Suspended</CardTitle>
          <CardDescription className="text-center">
            {currentOrganization?.name
              ? `${currentOrganization.name} is currently suspended and cannot access the platform.`
              : "This organization is currently suspended and cannot access the platform."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{kindLabel}</AlertTitle>
            {reason && <AlertDescription>{reason}</AlertDescription>}
          </Alert>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              If you believe this is in error, please contact your platform administrator
              or our support team to restore access.
            </p>
            {kind === "non_payment" && (
              <p>
                Outstanding invoices can typically be resolved through the billing portal.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {kind === "non_payment" && (
              <Button asChild variant="default" className="flex-1">
                <Link to="/billing">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Go to Billing
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="flex-1">
              <Link to="/support">Contact Support</Link>
            </Button>
            <Button variant="ghost" onClick={() => signOut()} className="flex-1">
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

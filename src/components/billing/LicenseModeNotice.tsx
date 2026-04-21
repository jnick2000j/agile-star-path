import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Server } from "lucide-react";
import type { LicenseEntitlements, DeploymentMode } from "@/hooks/useDeploymentMode";
import { format } from "date-fns";

interface Props {
  entitlements: LicenseEntitlements | null;
  deploymentMode: DeploymentMode;
  /** Optional inline variant — smaller, no card chrome. */
  variant?: "card" | "inline";
}

/**
 * Shown in place of Stripe-driven billing UI when the organization is running
 * on a license (on-prem / PO-billed). Conveys what's active and points the
 * admin at the right contact channel for changes.
 */
export function LicenseModeNotice({ entitlements, deploymentMode, variant = "card" }: Props) {
  const seats = entitlements?.seats;
  const aiCredits = entitlements?.ai_credits_monthly;
  const validUntil = entitlements?.valid_until ? new Date(entitlements.valid_until) : null;
  const customerRef = entitlements?.customer_reference;
  const tier = entitlements?.plan_tier;

  const modeLabel: Record<DeploymentMode, string> = {
    on_prem: "On-Premises",
    hybrid: "Hybrid",
    cloud: "Cloud (license-managed)",
  };

  const Icon = deploymentMode === "on_prem" ? Server : ShieldCheck;

  const Body = (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">Billing managed via your license</h3>
            <Badge variant="outline" className="bg-primary/5 border-primary/30">
              {modeLabel[deploymentMode]}
            </Badge>
            {tier && <Badge variant="outline">{tier}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            This organization runs on a signed license, so plan switching, Stripe
            checkout, and self-service cancellation are disabled. Contact your
            account manager to change seats, AI capacity, or renew your license.
          </p>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3 text-sm pt-2 border-t">
        {typeof seats === "number" && (
          <div>
            <dt className="text-muted-foreground">Licensed seats</dt>
            <dd className="font-medium">{seats === -1 ? "Unlimited" : seats.toLocaleString()}</dd>
          </div>
        )}
        {typeof aiCredits === "number" && (
          <div>
            <dt className="text-muted-foreground">AI credits / month</dt>
            <dd className="font-medium">
              {aiCredits === -1 ? "Unlimited" : aiCredits.toLocaleString()}
            </dd>
          </div>
        )}
        {validUntil && (
          <div>
            <dt className="text-muted-foreground">Valid until</dt>
            <dd className="font-medium">{format(validUntil, "MMM d, yyyy")}</dd>
          </div>
        )}
        {customerRef && (
          <div className="sm:col-span-3">
            <dt className="text-muted-foreground">License reference</dt>
            <dd className="font-mono text-xs">{customerRef}</dd>
          </div>
        )}
      </dl>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">{Body}</div>
    );
  }

  return <Card className="p-6 border-primary/30 bg-primary/5">{Body}</Card>;
}

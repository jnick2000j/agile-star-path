import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, AlertCircle, Headphones, GitPullRequest, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

const ADDON_META: Record<string, { label: string; icon: typeof Headphones; features: string[]; route: string; routeLabel: string }> = {
  helpdesk: {
    label: "Helpdesk + Learning",
    icon: Headphones,
    features: ["feature_helpdesk", "feature_lms"],
    route: "/helpdesk",
    routeLabel: "Open Helpdesk",
  },
  change_management: {
    label: "Change Management",
    icon: GitPullRequest,
    features: ["feature_change_management"],
    route: "/change-management",
    routeLabel: "Open Change Management",
  },
  itsm: {
    label: "ITSM + Learning Suite (Helpdesk + Change Management + LMS)",
    icon: Layers,
    features: ["feature_helpdesk", "feature_change_management", "feature_lms"],
    route: "/helpdesk",
    routeLabel: "Open Helpdesk",
  },
};

type Status = "confirming" | "activated" | "pending" | "core_success";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const sessionId = params.get("session_id");
  const purchaseType = params.get("purchase_type");
  const addonKey = params.get("addon");
  const addonName = params.get("addon_name");
  const isAddon = purchaseType === "addon" && addonKey;
  const meta = isAddon ? ADDON_META[addonKey] : null;

  const [status, setStatus] = useState<Status>("confirming");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    // Non-addon (core plan) purchase: simple delay then success
    if (!isAddon || !meta || !currentOrganization?.id) {
      const t = setTimeout(() => setStatus("core_success"), 1500);
      return () => clearTimeout(t);
    }

    // Addon: poll for feature activation via overrides table
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const checkActivation = async () => {
      const { data } = await supabase
        .from("organization_plan_overrides")
        .select("feature_key, value")
        .eq("organization_id", currentOrganization.id)
        .in("feature_key", meta.features);

      const activated = meta.features.every((fk) =>
        data?.some((row: any) => row.feature_key === fk && (row.value === true || row.value === "true"))
      );

      if (cancelled) return;
      if (activated) {
        setStatus("activated");
        return;
      }
      setAttempts((n) => n + 1);
      timer = setTimeout(checkActivation, 2000);
    };

    checkActivation();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isAddon, meta, currentOrganization?.id]);

  // After 6 attempts (~12s), show "pending" state — webhook may take longer
  useEffect(() => {
    if (status === "confirming" && attempts >= 6) setStatus("pending");
  }, [attempts, status]);

  const Icon = meta?.icon || CheckCircle2;
  const heading = isAddon
    ? meta?.label || addonName || "your add-on"
    : "your subscription";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        {status === "confirming" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Activating {heading}…</h1>
            <p className="text-sm text-muted-foreground">
              {isAddon
                ? "We're enabling your new module. This usually takes a few seconds."
                : "We're activating your plan. This only takes a moment."}
            </p>
          </>
        )}

        {status === "core_success" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Payment received</h1>
            <p className="text-sm text-muted-foreground">Thanks! Your subscription is active.</p>
            {sessionId && (
              <p className="text-xs text-muted-foreground break-all">Reference: {sessionId}</p>
            )}
            <Button onClick={() => navigate("/billing")} className="w-full">
              Go to billing
            </Button>
          </>
        )}

        {status === "activated" && meta && (
          <>
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <Badge variant="secondary" className="mx-auto">Add-on activated</Badge>
            <h1 className="text-2xl font-bold">{meta.label} is ready</h1>
            <p className="text-sm text-muted-foreground">
              The module is now enabled across your organization. You'll see new menu items in the sidebar
              and any team member with the right role can start using it immediately.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => navigate(meta.route)} className="w-full gap-2">
                <Icon className="h-4 w-4" />
                {meta.routeLabel}
              </Button>
              <Button variant="outline" onClick={() => navigate("/billing/addons")} className="w-full">
                Back to add-ons
              </Button>
            </div>
          </>
        )}

        {status === "pending" && meta && (
          <>
            <AlertCircle className="h-12 w-12 text-warning mx-auto" />
            <h1 className="text-2xl font-bold">Payment received</h1>
            <p className="text-sm text-muted-foreground">
              Your payment for <strong>{meta.label}</strong> went through, but activation is taking
              a little longer than usual. It'll be enabled within a couple of minutes — refresh the
              page or check back shortly.
            </p>
            {sessionId && (
              <p className="text-xs text-muted-foreground break-all">Reference: {sessionId}</p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => window.location.reload()} className="w-full">
                Check again
              </Button>
              <Button variant="outline" onClick={() => navigate("/billing/addons")} className="w-full">
                Back to add-ons
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

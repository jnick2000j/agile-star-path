import { ReactNode } from "react";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  /** When true, render nothing if the feature is unavailable. */
  silent?: boolean;
  /** Optional title shown in the default upgrade card. */
  title?: string;
  /** Optional description shown in the default upgrade card. */
  description?: string;
}

/**
 * Gates children behind a plan feature flag.
 * Resolves: org override → current plan → catalog default.
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  silent = false,
  title,
  description,
}: FeatureGateProps) {
  const { hasFeature, loading, catalog } = usePlanFeatures();
  const navigate = useNavigate();

  if (loading) return null;
  if (hasFeature(feature)) return <>{children}</>;

  if (silent) return null;
  if (fallback) return <>{fallback}</>;

  const meta = catalog.find((f) => f.feature_key === feature);

  return (
    <Card className="p-6 border-dashed bg-muted/30">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {title || meta?.name || "Premium feature"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {description ||
              meta?.description ||
              "This feature is available on a higher plan."}
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => navigate("/billing")}
          >
            Upgrade plan
          </Button>
        </div>
      </div>
    </Card>
  );
}

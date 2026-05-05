import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { formatPrice } from "@/lib/currency";

interface UsageRow {
  bytes_used: number;
  files_count: number;
  included_gb: number;
  last_recomputed_at: string;
}

const BYTES_PER_GB = 1024 * 1024 * 1024;

export function LmsStorageUsageCard() {
  const { currentOrganization } = useOrganization();
  const { hasFeature, getLimit } = usePlanFeatures();
  const [usage, setUsage] = useState<UsageRow | null>(null);
  const [loading, setLoading] = useState(true);

  const lmsOn = hasFeature("feature_lms");
  const includedGb = getLimit("lms_storage_included_gb") || 5;
  const perGbCents = getLimit("lms_storage_overage_per_gb_cents") || 25;

  useEffect(() => {
    if (!currentOrganization?.id || !lmsOn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("lms_storage_usage")
        .select("bytes_used, files_count, included_gb, last_recomputed_at")
        .eq("organization_id", currentOrganization.id)
        .maybeSingle();
      if (!cancelled) {
        setUsage(
          (data as UsageRow) ?? {
            bytes_used: 0,
            files_count: 0,
            included_gb: includedGb,
            last_recomputed_at: new Date().toISOString(),
          },
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, lmsOn, includedGb]);

  if (!lmsOn) return null;

  const bytes = usage?.bytes_used ?? 0;
  const usedGb = bytes / BYTES_PER_GB;
  const overageGb = Math.max(0, usedGb - includedGb);
  const monthlyOverageCents = Math.round(overageGb * perGbCents * 100) / 100;
  const pct = Math.min(100, (usedGb / Math.max(1, includedGb)) * 100);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">LMS storage</h3>
            <p className="text-sm text-muted-foreground">
              Course videos, lesson files and external training attachments.
            </p>
          </div>
        </div>
        <Badge variant="secondary">${(perGbCents / 100).toFixed(2)} / GB / month overage</Badge>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse bg-muted rounded" />
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-2 text-sm">
            <span>
              <span className="text-2xl font-bold">{usedGb.toFixed(2)} GB</span>
              <span className="text-muted-foreground"> used of {includedGb} GB included</span>
            </span>
            <span className="text-muted-foreground">{usage?.files_count ?? 0} files</span>
          </div>
          <Progress value={pct} className="h-2 mb-3" />
          {overageGb > 0 ? (
            <div className="text-sm">
              <span className="font-medium text-foreground">
                {overageGb.toFixed(2)} GB over included quota
              </span>
              <span className="text-muted-foreground">
                {" "}
                — projected overage this month:{" "}
                <span className="text-foreground font-medium">
                  {formatPrice("USD", monthlyOverageCents / 100)}
                </span>
              </span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              You have {Math.max(0, includedGb - usedGb).toFixed(2)} GB of included storage remaining.
            </div>
          )}
        </>
      )}
    </Card>
  );
}

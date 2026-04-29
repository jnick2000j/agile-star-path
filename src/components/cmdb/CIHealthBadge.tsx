import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  operational: "bg-success/10 text-success border-success/20",
  degraded: "bg-warning/10 text-warning border-warning/20",
  partial_outage: "bg-warning/20 text-warning border-warning/30",
  major_outage: "bg-destructive/10 text-destructive border-destructive/20",
  unknown: "bg-muted text-muted-foreground",
};

const LABELS: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  partial_outage: "Partial Outage",
  major_outage: "Major Outage",
  unknown: "Unknown",
};

export function CIHealthBadge({ state }: { state?: string | null }) {
  const key = state ?? "unknown";
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[key] ?? STYLES.unknown)}>
      {LABELS[key] ?? key}
    </Badge>
  );
}

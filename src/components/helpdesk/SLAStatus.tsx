import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SLAStatusProps {
  createdAt: string;
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  responseBreached: boolean;
  resolutionBreached: boolean;
  status: string;
}

function timer(due: string | null, completedAt: string | null, breached: boolean) {
  if (!due) return { label: "No SLA", variant: "muted", pct: 0 };
  if (completedAt) {
    return { label: "Met", variant: "success", pct: 100, icon: CheckCircle2 };
  }
  if (breached) {
    const overdue = formatDistanceToNow(new Date(due), { addSuffix: false });
    return { label: `Breached ${overdue} ago`, variant: "destructive", pct: 100, icon: AlertTriangle };
  }
  const dueDate = new Date(due);
  const remaining = formatDistanceToNow(dueDate, { addSuffix: true });
  const total = dueDate.getTime() - new Date(due).getTime();
  return { label: `Due ${remaining}`, variant: "default", pct: 50, icon: Clock };
}

export function SLAStatus({
  responseDueAt,
  resolutionDueAt,
  firstResponseAt,
  resolvedAt,
  responseBreached,
  resolutionBreached,
  status,
}: SLAStatusProps) {
  const isClosed = status === "closed" || status === "cancelled";
  const respState = timer(responseDueAt, firstResponseAt, responseBreached);
  const resolState = timer(resolutionDueAt, resolvedAt, resolutionBreached);

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Clock className="h-4 w-4" /> SLA Status
      </h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">First Response</span>
          {respState.variant === "success" && (
            <Badge className="bg-success/10 text-success text-xs">Met</Badge>
          )}
          {respState.variant === "destructive" && (
            <Badge variant="destructive" className="text-xs">Breached</Badge>
          )}
          {respState.variant === "default" && !isClosed && (
            <Badge variant="outline" className="text-xs">Pending</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{respState.label}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Resolution</span>
          {resolState.variant === "success" && (
            <Badge className="bg-success/10 text-success text-xs">Met</Badge>
          )}
          {resolState.variant === "destructive" && (
            <Badge variant="destructive" className="text-xs">Breached</Badge>
          )}
          {resolState.variant === "default" && !isClosed && (
            <Badge variant="outline" className="text-xs">Pending</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{resolState.label}</p>
      </div>
    </Card>
  );
}

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, CheckCircle2, PauseCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface SLAStatusProps {
  createdAt: string;
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  responseBreached: boolean;
  resolutionBreached: boolean;
  status: string;
  pausedAt?: string | null;
  pausedSeconds?: number | null;
}

type TimerState = {
  label: string;
  detail: string;
  variant: "muted" | "success" | "destructive" | "warning" | "default" | "paused";
  pct: number;
};

function buildTimer(
  createdAt: string,
  due: string | null,
  completedAt: string | null,
  breached: boolean,
  paused: boolean,
  isClosed: boolean,
): TimerState {
  if (!due) {
    return { label: "No SLA configured", detail: "", variant: "muted", pct: 0 };
  }
  if (completedAt) {
    return {
      label: "SLA met",
      detail: `Completed ${formatDistanceToNow(new Date(completedAt), { addSuffix: true })}`,
      variant: "success",
      pct: 100,
    };
  }
  if (breached) {
    return {
      label: "SLA breached",
      detail: `Was due ${formatDistanceToNow(new Date(due), { addSuffix: true })}`,
      variant: "destructive",
      pct: 100,
    };
  }
  if (paused) {
    return {
      label: "Paused",
      detail: `Clock paused — due ${formatDistanceToNow(new Date(due), { addSuffix: true })} when resumed`,
      variant: "paused",
      pct: 0,
    };
  }
  if (isClosed) {
    return {
      label: "Closed without meeting SLA",
      detail: `Was due ${formatDistanceToNow(new Date(due), { addSuffix: true })}`,
      variant: "muted",
      pct: 0,
    };
  }

  const now = Date.now();
  const start = new Date(createdAt).getTime();
  const dueMs = new Date(due).getTime();
  const totalMs = Math.max(1, dueMs - start);
  const elapsedMs = Math.max(0, now - start);
  const pct = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
  const remainingMs = dueMs - now;
  const isWarning = remainingMs > 0 && pct >= 75;

  return {
    label: isWarning ? "At risk" : "On track",
    detail: `Due ${formatDistanceToNow(new Date(due), { addSuffix: true })}`,
    variant: isWarning ? "warning" : "default",
    pct,
  };
}

function badgeFor(state: TimerState) {
  switch (state.variant) {
    case "success":
      return <Badge className="bg-success/10 text-success text-xs gap-1"><CheckCircle2 className="h-3 w-3" /> Met</Badge>;
    case "destructive":
      return <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Breached</Badge>;
    case "warning":
      return <Badge className="bg-warning/10 text-warning text-xs gap-1 border border-warning/30"><AlertTriangle className="h-3 w-3" /> At risk</Badge>;
    case "paused":
      return <Badge variant="outline" className="text-xs gap-1"><PauseCircle className="h-3 w-3" /> Paused</Badge>;
    case "muted":
      return <Badge variant="outline" className="text-xs">—</Badge>;
    default:
      return <Badge variant="outline" className="text-xs gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
  }
}

function progressClass(state: TimerState) {
  if (state.variant === "destructive") return "[&>div]:bg-destructive";
  if (state.variant === "warning") return "[&>div]:bg-warning";
  if (state.variant === "success") return "[&>div]:bg-success";
  if (state.variant === "paused") return "opacity-50";
  return "";
}

export function SLAStatus({
  createdAt,
  responseDueAt,
  resolutionDueAt,
  firstResponseAt,
  resolvedAt,
  responseBreached,
  resolutionBreached,
  status,
  pausedAt,
  pausedSeconds,
}: SLAStatusProps) {
  const isClosed = status === "closed" || status === "cancelled";
  const isPaused = !!pausedAt && !isClosed;
  const respState = buildTimer(createdAt, responseDueAt, firstResponseAt, responseBreached, isPaused, isClosed);
  const resolState = buildTimer(createdAt, resolutionDueAt, resolvedAt, resolutionBreached, isPaused, isClosed);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" /> SLA Status
        </h3>
        {isPaused && (
          <Badge variant="outline" className="gap-1 text-xs">
            <PauseCircle className="h-3 w-3" /> Clock paused
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">First Response</span>
          {badgeFor(respState)}
        </div>
        {responseDueAt && (
          <Progress
            value={respState.pct}
            className={cn("h-1.5", progressClass(respState))}
          />
        )}
        <p className="text-xs text-muted-foreground">{respState.detail || respState.label}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Resolution</span>
          {badgeFor(resolState)}
        </div>
        {resolutionDueAt && (
          <Progress
            value={resolState.pct}
            className={cn("h-1.5", progressClass(resolState))}
          />
        )}
        <p className="text-xs text-muted-foreground">{resolState.detail || resolState.label}</p>
      </div>

      {pausedSeconds && pausedSeconds > 0 && (
        <p className="text-[11px] text-muted-foreground border-t pt-2">
          Total paused time: {formatPaused(pausedSeconds)}
        </p>
      )}
    </Card>
  );
}

function formatPaused(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

/** Compact inline badge for ticket lists. */
export function SLABadge({
  responseDueAt,
  resolutionDueAt,
  firstResponseAt,
  resolvedAt,
  responseBreached,
  resolutionBreached,
  status,
  pausedAt,
}: Omit<SLAStatusProps, "createdAt" | "pausedSeconds">) {
  const isClosed = status === "closed" || status === "cancelled";
  if (resolvedAt || isClosed) {
    if (responseBreached || resolutionBreached) {
      return <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Breached</Badge>;
    }
    return <Badge className="bg-success/10 text-success text-[10px] gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> SLA met</Badge>;
  }
  if (responseBreached || resolutionBreached) {
    return <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Breached</Badge>;
  }
  if (pausedAt) {
    return <Badge variant="outline" className="text-[10px] gap-1"><PauseCircle className="h-2.5 w-2.5" /> Paused</Badge>;
  }
  const due = !firstResponseAt ? responseDueAt : resolutionDueAt;
  if (!due) return null;
  const remainingMs = new Date(due).getTime() - Date.now();
  if (remainingMs <= 0) {
    return <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Overdue</Badge>;
  }
  const totalMs = new Date(due).getTime() - Date.now();
  // At-risk if < 25% of original window remains. We approximate by hours.
  const hours = remainingMs / (1000 * 60 * 60);
  if (hours < 1) {
    return <Badge className="bg-warning/10 text-warning text-[10px] gap-1 border border-warning/30"><AlertTriangle className="h-2.5 w-2.5" /> &lt;1h left</Badge>;
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1">
      <Clock className="h-2.5 w-2.5" />
      {formatDistanceToNow(new Date(due))}
    </Badge>
  );
}

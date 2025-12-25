import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Programme {
  id: string;
  name: string;
  progress: number;
  status: "on-track" | "at-risk" | "delayed" | "completed";
  tranche: string;
}

const programmes: Programme[] = [
  { id: "1", name: "Digital Transformation Initiative", progress: 72, status: "on-track", tranche: "Tranche 2" },
  { id: "2", name: "Customer Experience Programme", progress: 45, status: "at-risk", tranche: "Tranche 1" },
  { id: "3", name: "Infrastructure Modernization", progress: 88, status: "on-track", tranche: "Tranche 3" },
  { id: "4", name: "Data Analytics Platform", progress: 23, status: "delayed", tranche: "Tranche 1" },
  { id: "5", name: "Security Enhancement Programme", progress: 100, status: "completed", tranche: "Complete" },
];

const statusColors = {
  "on-track": "bg-success",
  "at-risk": "bg-warning",
  delayed: "bg-destructive",
  completed: "bg-primary",
};

const statusLabels = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  delayed: "Delayed",
  completed: "Completed",
};

export function ProgrammeProgress() {
  return (
    <div className="metric-card animate-slide-up" style={{ animationDelay: "0.1s" }}>
      <h3 className="text-lg font-semibold text-foreground mb-6">Programme Progress</h3>
      <div className="space-y-5">
        {programmes.map((programme) => (
          <div key={programme.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{programme.name}</p>
                <p className="text-xs text-muted-foreground">{programme.tranche}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">{programme.progress}%</span>
                <span className={cn("status-badge", {
                  "status-active": programme.status === "on-track",
                  "status-pending": programme.status === "at-risk",
                  "status-at-risk": programme.status === "delayed",
                  "status-completed": programme.status === "completed",
                })}>
                  {statusLabels[programme.status]}
                </span>
              </div>
            </div>
            <Progress 
              value={programme.progress} 
              className="h-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Milestone {
  id: string;
  name: string;
  programme: string;
  dueDate: string;
  daysRemaining: number;
  priority: "high" | "medium" | "low";
}

const milestones: Milestone[] = [
  { id: "1", name: "Phase 2 Kickoff", programme: "Digital Transformation", dueDate: "Jan 15, 2025", daysRemaining: 3, priority: "high" },
  { id: "2", name: "Stakeholder Review", programme: "CX Programme", dueDate: "Jan 18, 2025", daysRemaining: 6, priority: "medium" },
  { id: "3", name: "Infrastructure Go-Live", programme: "Infrastructure Mod", dueDate: "Jan 22, 2025", daysRemaining: 10, priority: "high" },
  { id: "4", name: "UAT Completion", programme: "Data Analytics", dueDate: "Jan 28, 2025", daysRemaining: 16, priority: "low" },
];

const priorityClasses = {
  high: "border-l-destructive",
  medium: "border-l-warning",
  low: "border-l-success",
};

export function UpcomingMilestones() {
  return (
    <div className="metric-card animate-slide-up" style={{ animationDelay: "0.25s" }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Upcoming Milestones</h3>
        <Calendar className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-3">
        {milestones.map((milestone) => (
          <div 
            key={milestone.id} 
            className={cn(
              "p-3 rounded-lg bg-secondary/50 border-l-4",
              priorityClasses[milestone.priority]
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{milestone.name}</p>
                <p className="text-xs text-muted-foreground">{milestone.programme}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{milestone.dueDate}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className={cn(
                    "text-xs font-medium",
                    milestone.daysRemaining <= 5 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {milestone.daysRemaining}d remaining
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

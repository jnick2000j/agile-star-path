import { AlertTriangle, CheckCircle, FileText, Users, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  type: "risk" | "milestone" | "document" | "stakeholder" | "update";
  title: string;
  description: string;
  time: string;
  user: string;
}

const activities: Activity[] = [
  {
    id: "1",
    type: "risk",
    title: "New risk identified",
    description: "Resource availability risk added to Digital Transformation",
    time: "10 minutes ago",
    user: "Sarah Johnson",
  },
  {
    id: "2",
    type: "milestone",
    title: "Milestone completed",
    description: "Phase 2 delivery completed for CX Programme",
    time: "1 hour ago",
    user: "Michael Chen",
  },
  {
    id: "3",
    type: "document",
    title: "Document updated",
    description: "Programme Blueprint v2.1 published",
    time: "2 hours ago",
    user: "Emma Wilson",
  },
  {
    id: "4",
    type: "stakeholder",
    title: "Stakeholder meeting scheduled",
    description: "Quarterly review with senior sponsors",
    time: "3 hours ago",
    user: "James Taylor",
  },
  {
    id: "5",
    type: "update",
    title: "Weekly report submitted",
    description: "Infrastructure Programme week 23 report",
    time: "5 hours ago",
    user: "Lisa Brown",
  },
];

const typeIcons = {
  risk: AlertTriangle,
  milestone: CheckCircle,
  document: FileText,
  stakeholder: Users,
  update: MessageSquare,
};

const typeColors = {
  risk: "bg-warning/10 text-warning",
  milestone: "bg-success/10 text-success",
  document: "bg-primary/10 text-primary",
  stakeholder: "bg-info/10 text-info",
  update: "bg-muted text-muted-foreground",
};

export function RecentActivity() {
  return (
    <div className="metric-card animate-slide-up" style={{ animationDelay: "0.2s" }}>
      <h3 className="text-lg font-semibold text-foreground mb-6">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = typeIcons[activity.type];
          return (
            <div key={activity.id} className="flex gap-4">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", typeColors[activity.type])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{activity.title}</p>
                <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{activity.user}</span>
                  <span>•</span>
                  <span>{activity.time}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays, format, parseISO } from "date-fns";

const priorityClasses = {
  high: "border-l-destructive",
  medium: "border-l-warning",
  low: "border-l-success",
};

export function UpcomingMilestones() {
  // Using projects with end dates as milestones
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["upcoming-milestones"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, end_date, priority, programmes(name)")
        .gte("end_date", today)
        .order("end_date")
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="metric-card animate-slide-up" style={{ animationDelay: "0.25s" }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Upcoming Milestones</h3>
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="metric-card animate-slide-up" style={{ animationDelay: "0.25s" }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Upcoming Milestones</h3>
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-center py-8 text-muted-foreground">
          No upcoming milestones. Projects with end dates will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="metric-card animate-slide-up" style={{ animationDelay: "0.25s" }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Upcoming Milestones</h3>
        <Calendar className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-3">
        {projects.map((project) => {
          const daysRemaining = project.end_date 
            ? differenceInDays(parseISO(project.end_date), new Date())
            : 0;
          const priority = project.priority as keyof typeof priorityClasses || "medium";
          
          return (
            <div 
              key={project.id} 
              className={cn(
                "p-3 rounded-lg bg-secondary/50 border-l-4",
                priorityClasses[priority] || priorityClasses.medium
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.programmes?.name || "No program"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {project.end_date ? format(parseISO(project.end_date), "MMM d, yyyy") : "No date"}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className={cn(
                      "text-xs font-medium",
                      daysRemaining <= 5 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {daysRemaining}d remaining
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

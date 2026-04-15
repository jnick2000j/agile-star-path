import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, FileText, Users, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const typeIcons = {
  risk: AlertTriangle,
  programme: Layers,
  project: FileText,
  stakeholder: Users,
  benefit: CheckCircle,
};

const typeColors = {
  risk: "bg-warning/10 text-warning",
  programme: "bg-primary/10 text-primary",
  project: "bg-info/10 text-info",
  stakeholder: "bg-muted text-muted-foreground",
  benefit: "bg-success/10 text-success",
};

interface Activity {
  id: string;
  type: keyof typeof typeIcons;
  title: string;
  description: string;
  time: string;
}

export function RecentActivity() {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      // Fetch recent items from multiple tables
      const [risksRes, programmesRes, projectsRes] = await Promise.all([
        supabase
          .from("risks")
          .select("id, title, created_at")
          .order("created_at", { ascending: false })
          .limit(2),
        supabase
          .from("programmes")
          .select("id, name, created_at")
          .order("created_at", { ascending: false })
          .limit(2),
        supabase
          .from("projects")
          .select("id, name, created_at")
          .order("created_at", { ascending: false })
          .limit(2),
      ]);

      const allActivities: Activity[] = [];

      if (risksRes.data) {
        risksRes.data.forEach(risk => {
          allActivities.push({
            id: risk.id,
            type: "risk",
            title: "Risk added",
            description: risk.title,
            time: risk.created_at,
          });
        });
      }

      if (programmesRes.data) {
        programmesRes.data.forEach(prog => {
          allActivities.push({
            id: prog.id,
            type: "program",
            title: "Program created",
            description: prog.name,
            time: prog.created_at,
          });
        });
      }

      if (projectsRes.data) {
        projectsRes.data.forEach(proj => {
          allActivities.push({
            id: proj.id,
            type: "project",
            title: "Project created",
            description: proj.name,
            time: proj.created_at,
          });
        });
      }

      // Sort by time and take top 5
      return allActivities
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 5);
    },
  });

  if (isLoading) {
    return (
      <div className="metric-card animate-slide-up" style={{ animationDelay: "0.2s" }}>
        <h3 className="text-lg font-semibold text-foreground mb-6">Recent Activity</h3>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="metric-card animate-slide-up" style={{ animationDelay: "0.2s" }}>
        <h3 className="text-lg font-semibold text-foreground mb-6">Recent Activity</h3>
        <div className="text-center py-8 text-muted-foreground">
          No recent activity. Start creating programmes, projects, or risks.
        </div>
      </div>
    );
  }

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
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

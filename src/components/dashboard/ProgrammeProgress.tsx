import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const statusLabels = {
  active: "Active",
  completed: "Completed",
  "on-hold": "On Hold",
  cancelled: "Cancelled",
};

const getStatusClass = (status: string, progress: number) => {
  if (progress >= 100) return "status-completed";
  if (status === "on-hold") return "status-pending";
  if (progress < 30) return "status-at-risk";
  return "status-active";
};

export function ProgrammeProgress() {
  const { data: programmes = [], isLoading } = useQuery({
    queryKey: ["programmes-progress"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programmes")
        .select("id, name, progress, status, tranche")
        .order("name")
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="metric-card animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <h3 className="text-lg font-semibold text-foreground mb-6">Program Progress</h3>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (programmes.length === 0) {
    return (
      <div className="metric-card animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <h3 className="text-lg font-semibold text-foreground mb-6">Program Progress</h3>
        <div className="text-center py-8 text-muted-foreground">
          No programs yet. Create your first program to track progress.
        </div>
      </div>
    );
  }

  return (
    <div className="metric-card animate-slide-up" style={{ animationDelay: "0.1s" }}>
      <h3 className="text-lg font-semibold text-foreground mb-6">Program Progress</h3>
      <div className="space-y-5">
        {programmes.map((programme) => (
          <div key={programme.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{programme.name}</p>
                <p className="text-xs text-muted-foreground">{programme.tranche || "No tranche"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">{programme.progress}%</span>
                <span className={cn("status-badge", getStatusClass(programme.status, programme.progress))}>
                  {statusLabels[programme.status as keyof typeof statusLabels] || programme.status}
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

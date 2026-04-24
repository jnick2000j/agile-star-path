import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layers, FolderKanban, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const healthColor: Record<string, string> = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
};

const statusToHealth = (status: string): string => {
  if (["active", "in_progress", "live"].includes(status)) return "green";
  if (["on_hold", "at_risk", "concept", "planning"].includes(status)) return "amber";
  if (["cancelled", "closed", "failed"].includes(status)) return "red";
  return "amber";
};

interface EntityItem {
  id: string;
  name: string;
  health: string;
}

interface EntityGroup {
  label: string;
  icon: React.ReactNode;
  items: EntityItem[];
  basePath: string;
}

export function StatusIndicators() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["status-indicators"],
    queryFn: async () => {
      const [progs, projs, prods] = await Promise.all([
        supabase.from("programmes").select("id, name, status"),
        supabase.from("projects").select("id, name, health"),
        supabase.from("products").select("id, name, status"),
      ]);
      return {
        programmes: (progs.data || []).map((p) => ({ id: p.id, name: p.name, health: statusToHealth(p.status) })),
        projects: (projs.data || []).map((p) => ({ id: p.id, name: p.name, health: p.health || "amber" })),
        products: (prods.data || []).map((p) => ({ id: p.id, name: p.name, health: statusToHealth(p.status) })),
      };
    },
  });

  const groups: EntityGroup[] = [
    { label: "Programmes", icon: <Layers className="h-4 w-4" />, items: data?.programmes || [], basePath: "/programmes/details" },
    { label: "Projects", icon: <FolderKanban className="h-4 w-4" />, items: data?.projects || [], basePath: "/projects/details" },
    { label: "Products", icon: <Package className="h-4 w-4" />, items: data?.products || [], basePath: "/products/details" },
  ];

  if (isLoading) {
    return (
      <div className="metric-card animate-slide-up">
        <h3 className="text-lg font-semibold text-foreground mb-4">Status Overview</h3>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const allEmpty = groups.every((g) => g.items.length === 0);

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4">Status Overview</h3>
      {allEmpty ? (
        <div className="metric-card text-center py-8 text-muted-foreground">No entities to display.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {groups.map((group) => (
            <div key={group.label} className="metric-card animate-slide-up">
              <div className="flex items-center gap-2 mb-3">
                {group.icon}
                <span className="text-sm font-medium text-foreground">{group.label}</span>
              </div>
              {group.items.length > 0 ? (
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(`${group.basePath}?id=${item.id}`)}
                      className="flex items-center gap-2 w-full text-left rounded-md px-2 py-1 hover:bg-accent/50 transition-colors group"
                    >
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", healthColor[item.health] || "bg-muted-foreground")} />
                      <span className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{item.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

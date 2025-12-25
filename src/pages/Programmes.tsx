import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Calendar,
  Users,
  Target,
  ArrowUpRight,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateProgrammeDialog } from "@/components/dialogs/CreateProgrammeDialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

interface Programme {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  sponsor: string | null;
  tranche: string | null;
  budget: string | null;
  benefits_target: string | null;
  organization_id: string | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/10 text-success border-success/20" },
  "at-risk": { label: "At Risk", className: "bg-destructive/10 text-destructive border-destructive/20" },
  "on-hold": { label: "On Hold", className: "bg-warning/10 text-warning border-warning/20" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary border-primary/20" },
};

export default function Programmes() {
  const [searchQuery, setSearchQuery] = useState("");
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    fetchProgrammes();
  }, [currentOrganization]);

  const fetchProgrammes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("programmes")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by organization if one is selected
      if (currentOrganization) {
        query = query.eq("organization_id", currentOrganization.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProgrammes(data || []);
    } catch (error) {
      console.error("Error fetching programmes:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProgrammes = programmes.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Programmes" subtitle="Manage programme portfolio">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search programmes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <CreateProgrammeDialog />
        </div>
      </div>

      {/* Programme Cards */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredProgrammes.map((programme, index) => (
          <div
            key={programme.id}
            className="metric-card group animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{programme.id}</span>
                  <Badge variant="outline" className={cn("text-xs", statusConfig[programme.status].className)}>
                    {statusConfig[programme.status].label}
                  </Badge>
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {programme.name}
                </h3>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {programme.description}
            </p>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{programme.progress}%</span>
              </div>
              <Progress value={programme.progress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{programme.tranche || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{programme.status}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>{programme.benefits_target || "N/A"}</span>
              </div>
              <div className="text-muted-foreground">
                Budget: {programme.budget || "N/A"}
              </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">Sponsor: </span>
                <span className="font-medium">{programme.sponsor || "Unassigned"}</span>
              </div>
              <Button variant="ghost" size="sm" className="gap-1">
                View Details
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}

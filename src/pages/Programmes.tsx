import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Calendar,
  Target,
  ArrowUpRight,
  Building2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateProgrammeDialog } from "@/components/dialogs/CreateProgrammeDialog";
import { EditProgrammeDialog } from "@/components/dialogs/EditProgrammeDialog";
import { EntityStatusActions } from "@/components/EntityStatusActions";
import { DocumentUpload } from "@/components/DocumentUpload";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { SavedViewsBar } from "@/components/views/SavedViewsBar";
import { programmesSchema } from "@/lib/viewSchemas/registers";
import { applyFilters, applySort } from "@/lib/viewSchemas/applyFilters";
import type { ViewFilter } from "@/lib/viewSchemas/types";

interface Program {
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
  manager_id: string | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/10 text-success border-success/20" },
  "at-risk": { label: "At Risk", className: "bg-destructive/10 text-destructive border-destructive/20" },
  "on-hold": { label: "On Hold", className: "bg-warning/10 text-warning border-warning/20" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary border-primary/20" },
  pending: { label: "Pending", className: "bg-info/10 text-info border-info/20" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
  deferred: { label: "Deferred", className: "bg-muted text-muted-foreground border-muted" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground border-muted" },
};

export default function Programmes() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [assignmentChip, setAssignmentChip] = useState<string | null>(null);
  const [programmes, setProgrammes] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();
  const { user, userRole } = useAuth();
  const { hasFullOrgAccess } = useOrgAccessLevel();
  const [filters, setFilters] = useState<ViewFilter[]>([]);
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" } | null>(null);
  const [editingProgramme, setEditingProgramme] = useState<Program | null>(null);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProgrammes();
  }, [currentOrganization, user, hasFullOrgAccess]);

  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name, email").then(({ data }) => {
      if (!data) return;
      const m: Record<string, string> = {};
      data.forEach((p: any) => { m[p.user_id] = p.full_name || p.email; });
      setUserMap(m);
    });
  }, []);

  const fetchProgrammes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("programmes")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by organization if one is selected (include legacy programmes with no org)
      if (currentOrganization) {
        query = query.or(`organization_id.eq.${currentOrganization.id},organization_id.is.null`);
      }

      // Programme stakeholders only see assigned programmes
      if (userRole === "programme_stakeholder" && user) {
        const { data: accessData } = await supabase
          .from("user_programme_access")
          .select("programme_id")
          .eq("user_id", user.id);
        const programmeIds = accessData?.map(a => a.programme_id) || [];
        if (programmeIds.length > 0) {
          query = query.in("id", programmeIds);
        } else {
          setProgrammes([]);
          setLoading(false);
          return;
        }
      }
      // Project/product stakeholders see nothing on programmes page
      else if ((userRole === "project_stakeholder" || userRole === "product_stakeholder") && user) {
        setProgrammes([]);
        setLoading(false);
        return;
      }
      // Org stakeholders see everything (no extra filter)
      // Editors/viewers at org level only see assigned programmes
      else if (!hasFullOrgAccess && userRole !== "org_stakeholder" && user) {
        const { data: accessData } = await supabase
          .from("user_programme_access")
          .select("programme_id")
          .eq("user_id", user.id);
        const programmeIds = accessData?.map(a => a.programme_id) || [];
        const { data: managedData } = await supabase
          .from("programmes")
          .select("id")
          .eq("manager_id", user.id);
        const managedIds = managedData?.map(p => p.id) || [];
        const allIds = [...new Set([...programmeIds, ...managedIds])];
        if (allIds.length > 0) {
          query = query.in("id", allIds);
        } else {
          setProgrammes([]);
          setLoading(false);
          return;
        }
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

  const filteredPrograms = (() => {
    const bySearch = programmes.filter((p) =>
      !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const byAssignment = bySearch.filter((p) => {
      if (!assignmentChip) return true;
      const uid = (user as any)?.id;
      const owner = (p as any).programme_manager_id ?? (p as any).owner_id;
      if (assignmentChip === "me" || assignmentChip === "my_team") return owner === uid;
      if (assignmentChip === "unassigned") return !owner;
      if (assignmentChip === "created_by_me") return (p as any).created_by === uid;
      if (assignmentChip === "mentioned_me") return false;
      return true;
    });
    const byFilters = applyFilters(byAssignment, filters, { userId: user?.id });
    return applySort(byFilters, sort);
  })();

  return (
    <AppLayout title="Programs" subtitle="Manage programme portfolio">
      <div className="mb-4">
        <SavedViewsBar
          scope="programmes.list"
          schema={programmesSchema}
          showAssignmentChips
          state={{ filters: filters as any, sort, assignment: assignmentChip }}
          onApply={(cfg) => {
            const f = cfg.filters as any;
            setFilters(Array.isArray(f) ? (f as ViewFilter[]) : []);
            setSort(cfg.sort ?? null);
            setAssignmentChip(cfg.assignment ?? null);
          }}
          leading={
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search programmes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm bg-background"
              />
            </div>
          }
          trailing={<CreateProgrammeDialog />}
        />
      </div>

      {/* Program Cards */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredPrograms.map((programme, index) => (
          <div
            key={programme.id}
            className="metric-card group animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{programme.id}</span>
                  <Badge variant="outline" className={cn("text-xs", (statusConfig[programme.status] || statusConfig.active).className)}>
                    {(statusConfig[programme.status] || { label: programme.status }).label}
                  </Badge>
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {programme.name}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => { e.stopPropagation(); setEditingProgramme(programme); }}
                  title="Edit program"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <DocumentUpload
                  entityType="program"
                  entityId={programme.id}
                  entityName={programme.name}
                  variant="icon"
                />
                <EntityStatusActions
                  entityType="program"
                  entityId={programme.id}
                  entityName={programme.name}
                  currentStatus={programme.status}
                  onStatusChange={fetchProgrammes}
                  compact
                />
              </div>
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
                <span className="font-medium">{programme.sponsor ? (userMap[programme.sponsor] || programme.sponsor) : "Unassigned"}</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1"
                onClick={() => navigate(`/programmes/details?id=${programme.id}`)}
              >
                View Details
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {editingProgramme && (
        <EditProgrammeDialog
          programme={editingProgramme}
          open={!!editingProgramme}
          onOpenChange={(o) => !o && setEditingProgramme(null)}
          onSuccess={fetchProgrammes}
        />
      )}
    </AppLayout>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  LayoutGrid,
  List,
  Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import { projectsSchema } from "@/lib/viewSchemas/registers";
import { applyFilters, applySort } from "@/lib/viewSchemas/applyFilters";
import type { ViewFilter } from "@/lib/viewSchemas/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateProjectDialog } from "@/components/dialogs/CreateProjectDialog";
import { EditProjectDialog } from "@/components/dialogs/EditProjectDialog";
import { EntityStatusActions } from "@/components/EntityStatusActions";
import { DocumentUpload } from "@/components/DocumentUpload";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { SavedViewsBar } from "@/components/views/SavedViewsBar";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";

interface Project {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  priority: string;
  health: string;
  methodology: string;
  start_date: string | null;
  end_date: string | null;
  organization_id: string | null;
  programme_id: string | null;
  manager_id: string | null;
}

const stageConfig: Record<string, { label: string; className: string }> = {
  initiating: { label: "Initiating", className: "bg-info/10 text-info" },
  planning: { label: "Planning", className: "bg-primary/10 text-primary" },
  executing: { label: "Executing", className: "bg-success/10 text-success" },
  closing: { label: "Closing", className: "bg-warning/10 text-warning" },
  completed: { label: "Completed", className: "bg-muted text-muted-foreground" },
};

const healthConfig: Record<string, string> = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: "High", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning" },
  low: { label: "Low", className: "bg-success/10 text-success" },
};

export default function Projects() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();
  const { canManage } = usePermissions();
  const { user, userRole } = useAuth();
  const { hasFullOrgAccess } = useOrgAccessLevel();
  const [filters, setFilters] = useState<ViewFilter[]>([]);
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" } | null>(null);
  const [assignmentChip, setAssignmentChip] = useState<string | null>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [currentOrganization, user, userRole, hasFullOrgAccess]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (currentOrganization) {
        query = query.or(`organization_id.eq.${currentOrganization.id},organization_id.is.null`);
      }

      // Project managers only see projects assigned to them
      if (userRole === "project_manager" && user) {
        query = query.eq("manager_id", user.id);
      }
      // Project team members & project stakeholders only see assigned projects
      else if ((userRole === "project_team_member" || userRole === "project_stakeholder") && user) {
        const { data: accessData } = await supabase
          .from("user_project_access")
          .select("project_id")
          .eq("user_id", user.id);
        const projectIds = accessData?.map(a => a.project_id) || [];
        if (projectIds.length > 0) {
          query = query.in("id", projectIds);
        } else {
          setProjects([]);
          setLoading(false);
          return;
        }
      }
      // Product stakeholders see nothing on projects page (not their scope)
      else if (userRole === "product_stakeholder" && user) {
        setProjects([]);
        setLoading(false);
        return;
      }
      // Programme stakeholders see only projects under their assigned programmes
      else if (userRole === "programme_stakeholder" && user) {
        const { data: progAccess } = await supabase
          .from("user_programme_access")
          .select("programme_id")
          .eq("user_id", user.id);
        const progIds = progAccess?.map(a => a.programme_id) || [];
        if (progIds.length > 0) {
          query = query.in("programme_id", progIds);
        } else {
          setProjects([]);
          setLoading(false);
          return;
        }
      }
      // Org stakeholders see everything (no extra filter needed beyond org)
      // Editors/viewers at org level only see assigned projects
      else if (!hasFullOrgAccess && userRole !== "org_stakeholder" && user) {
        const { data: accessData } = await supabase
          .from("user_project_access")
          .select("project_id")
          .eq("user_id", user.id);
        const projectIds = accessData?.map(a => a.project_id) || [];
        const { data: managedData } = await supabase
          .from("projects")
          .select("id")
          .eq("manager_id", user.id);
        const managedIds = managedData?.map(p => p.id) || [];
        const allIds = [...new Set([...projectIds, ...managedIds])];
        if (allIds.length > 0) {
          query = query.in("id", allIds);
        } else {
          setProjects([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = (() => {
    const bySearch = projects.filter((p) =>
      !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const byAssignment = bySearch.filter((p) => {
      if (!assignmentChip) return true;
      const uid = (user as any)?.id;
      const owner = (p as any).project_manager_id ?? (p as any).owner_id ?? (p as any).manager_id;
      if (assignmentChip === "me" || assignmentChip === "my_team") return owner === uid;
      if (assignmentChip === "unassigned") return !owner;
      if (assignmentChip === "created_by_me") return (p as any).created_by === uid;
      return false;
    });
    const byFilters = applyFilters(byAssignment, filters, { userId: user?.id });
    return applySort(byFilters, sort);
  })();

  const handleEditClick = (project: Project) => {
    setSelectedProject(project);
    setEditDialogOpen(true);
  };

  return (
    <AppLayout title="Projects" subtitle="Manage all projects across programmes">
      <div className="mb-4">
        <SavedViewsBar
          scope="projects.list"
          schema={projectsSchema}
          showAssignmentChips
          state={{
            filters: filters as any,
            sort,
            layout: viewMode === "grid" ? "board" : "table",
            assignment: assignmentChip,
          }}
          onApply={(cfg) => {
            const f = cfg.filters as any;
            setFilters(Array.isArray(f) ? (f as ViewFilter[]) : []);
            setSort(cfg.sort ?? null);
            if (cfg.layout === "board") setViewMode("grid");
            else if (cfg.layout === "table" || cfg.layout === "list") setViewMode("list");
            setAssignmentChip(cfg.assignment ?? null);
          }}
          leading={
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search projects…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm bg-background"
              />
            </div>
          }
          trailing={
            <>
              <div className="flex border border-border rounded-md p-0.5 bg-background">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
              </div>
              {canManage("projects") && <CreateProjectDialog onSuccess={fetchProjects} />}
            </>
          }
        />
      </div>

      {/* Projects Table */}
      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Methodology</TableHead>
              <TableHead>Timeline</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading projects...
                </TableCell>
              </TableRow>
            ) : filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No projects found
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((project, index) => (
                <TableRow 
                  key={project.id} 
                  className="animate-fade-in cursor-pointer hover:bg-muted/50"
                  style={{ animationDelay: `${index * 0.03}s` }}
                  onClick={() => navigate(`/projects/details?id=${project.id}`)}
                >
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", stageConfig[project.stage]?.className || "")}>
                      {stageConfig[project.stage]?.label || project.stage}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", priorityConfig[project.priority]?.className || "")}>
                      {priorityConfig[project.priority]?.label || project.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2.5 w-2.5 rounded-full", healthConfig[project.health] || "bg-muted")} />
                      <span className="text-sm capitalize">{project.health}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {project.methodology}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.start_date || "N/A"} - {project.end_date || "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(project);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DocumentUpload
                          entityType="project"
                          entityId={project.id}
                          entityName={project.name}
                          variant="icon"
                        />
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <EntityStatusActions
                          entityType="project"
                          entityId={project.id}
                          entityName={project.name}
                          currentStatus={project.stage}
                          onStatusChange={fetchProjects}
                          compact
                        />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Project Dialog */}
      {selectedProject && (
        <EditProjectDialog
          project={selectedProject}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchProjects}
        />
      )}
    </AppLayout>
  );
}

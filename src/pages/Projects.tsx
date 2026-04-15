import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter,
  LayoutGrid,
  List,
  Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
  const [stageFilters, setStageFilters] = useState<string[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [healthFilters, setHealthFilters] = useState<string[]>([]);
  
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
        query = query.eq("organization_id", currentOrganization.id);
      }

      // Project managers only see projects assigned to them
      if (userRole === "project_manager" && user) {
        query = query.eq("manager_id", user.id);
      }
      // Project team members only see projects they have access to
      else if (userRole === "project_team_member" && user) {
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
      // Editors/viewers at org level only see assigned projects
      else if (!hasFullOrgAccess && user) {
        const { data: accessData } = await supabase
          .from("user_project_access")
          .select("project_id")
          .eq("user_id", user.id);
        const projectIds = accessData?.map(a => a.project_id) || [];
        // Also include projects where user is the manager
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

  const toggleFilter = (value: string, filters: string[], setFilters: React.Dispatch<React.SetStateAction<string[]>>) => {
    setFilters(prev => 
      prev.includes(value) 
        ? prev.filter(s => s !== value)
        : [...prev, value]
    );
  };

  const clearFilters = () => {
    setStageFilters([]);
    setPriorityFilters([]);
    setHealthFilters([]);
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilters.length === 0 || stageFilters.includes(p.stage);
    const matchesPriority = priorityFilters.length === 0 || priorityFilters.includes(p.priority);
    const matchesHealth = healthFilters.length === 0 || healthFilters.includes(p.health);
    return matchesSearch && matchesStage && matchesPriority && matchesHealth;
  });

  const activeFilterCount = stageFilters.length + priorityFilters.length + healthFilters.length;

  const handleEditClick = (project: Project) => {
    setSelectedProject(project);
    setEditDialogOpen(true);
  };

  return (
    <AppLayout title="Projects" subtitle="Manage all projects across programmes">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex border border-border rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Filters</h4>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs text-muted-foreground">
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Stage</Label>
                  {Object.entries(stageConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`stage-${key}`} 
                        checked={stageFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, stageFilters, setStageFilters)}
                      />
                      <label htmlFor={`stage-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`priority-${key}`} 
                        checked={priorityFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, priorityFilters, setPriorityFilters)}
                      />
                      <label htmlFor={`priority-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Health</Label>
                  {Object.entries(healthConfig).map(([key]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`health-${key}`} 
                        checked={healthFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, healthFilters, setHealthFilters)}
                      />
                      <label htmlFor={`health-${key}`} className="text-sm cursor-pointer flex-1 capitalize">
                        {key}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {canManage("projects") && <CreateProjectDialog onSuccess={fetchProjects} />}
        </div>
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

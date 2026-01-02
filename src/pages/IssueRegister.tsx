import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter,
  AlertCircle,
  Pencil,
  Download
} from "lucide-react";
import { CreateIssueDialog } from "@/components/dialogs/CreateIssueDialog";
import { EditRegisterItemDialog } from "@/components/dialogs/EditRegisterItemDialog";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

interface Issue {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  date_raised: string | null;
  target_date: string | null;
  resolution: string | null;
  owner_id: string | null;
  programme_id: string | null;
  project_id: string | null;
}

const typeConfig: Record<string, { label: string; className: string }> = {
  problem: { label: "Problem", className: "bg-destructive/10 text-destructive" },
  concern: { label: "Concern", className: "bg-warning/10 text-warning" },
  "change-request": { label: "Change Request", className: "bg-primary/10 text-primary" },
  "off-specification": { label: "Off-Spec", className: "bg-info/10 text-info" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-destructive text-destructive-foreground" },
  high: { label: "High", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning" },
  low: { label: "Low", className: "bg-success/10 text-success" },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-destructive/10 text-destructive" },
  investigating: { label: "Investigating", className: "bg-warning/10 text-warning" },
  pending: { label: "Pending", className: "bg-info/10 text-info" },
  resolved: { label: "Resolved", className: "bg-success/10 text-success" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

export default function IssueRegister() {
  const { currentOrganization } = useOrganization();
  const { canManage } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  useEffect(() => {
    fetchIssues();
  }, [currentOrganization]);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false });

      if (currentOrganization) {
        query = query.eq("organization_id", currentOrganization.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setIssues(data || []);
    } catch (error) {
      console.error("Error fetching issues:", error);
      toast.error("Failed to load issues");
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
    setTypeFilters([]);
    setPriorityFilters([]);
    setStatusFilters([]);
  };

  const filteredIssues = issues.filter((i) => {
    const matchesSearch = i.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilters.length === 0 || typeFilters.includes(i.type);
    const matchesPriority = priorityFilters.length === 0 || priorityFilters.includes(i.priority);
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(i.status);
    return matchesSearch && matchesType && matchesPriority && matchesStatus;
  });

  const activeFilterCount = typeFilters.length + priorityFilters.length + statusFilters.length;

  const handleEditClick = (issue: Issue) => {
    setSelectedIssue(issue);
    setEditDialogOpen(true);
  };

  return (
    <AppLayout title="Issue Register" subtitle="PRINCE2 MSP issue management">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{issues.length}</p>
              <p className="text-sm text-muted-foreground">Total Issues</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertCircle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{issues.filter(i => i.status === "open" || i.status === "investigating").length}</p>
              <p className="text-sm text-muted-foreground">Active Issues</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{issues.filter(i => i.priority === "critical" || i.priority === "high").length}</p>
              <p className="text-sm text-muted-foreground">High Priority</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <AlertCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{issues.filter(i => i.status === "resolved" || i.status === "closed").length}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
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
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  {Object.entries(typeConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`type-${key}`} 
                        checked={typeFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, typeFilters, setTypeFilters)}
                      />
                      <label htmlFor={`type-${key}`} className="text-sm cursor-pointer flex-1">
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
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`status-${key}`} 
                        checked={statusFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, statusFilters, setStatusFilters)}
                      />
                      <label htmlFor={`status-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {canManage("issues") && <CreateIssueDialog onSuccess={fetchIssues} />}
        </div>
      </div>

      {/* Issues Table */}
      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issue Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Target Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading issues...
                </TableCell>
              </TableRow>
            ) : filteredIssues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No issues found. Create your first issue to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredIssues.map((issue, index) => (
                <TableRow 
                  key={issue.id} 
                  className="animate-fade-in cursor-pointer hover:bg-muted/50"
                  style={{ animationDelay: `${index * 0.03}s` }}
                  onClick={() => handleEditClick(issue)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{issue.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{issue.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", typeConfig[issue.type]?.className || "")}>
                      {typeConfig[issue.type]?.label || issue.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", priorityConfig[issue.priority]?.className || "")}>
                      {priorityConfig[issue.priority]?.label || issue.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{issue.target_date || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", statusConfig[issue.status]?.className || "")}>
                      {statusConfig[issue.status]?.label || issue.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(issue);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Issue Dialog */}
      {selectedIssue && (
        <EditRegisterItemDialog
          item={selectedIssue}
          type="issues"
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchIssues}
        />
      )}
    </AppLayout>
  );
}

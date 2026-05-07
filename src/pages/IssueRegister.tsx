import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  AlertCircle,
  Pencil,
  Download
} from "lucide-react";
import { CreateIssueDialog } from "@/components/dialogs/CreateIssueDialog";
import { SavedViewsBar } from "@/components/views/SavedViewsBar";
import { EditRegisterItemDialog } from "@/components/dialogs/EditRegisterItemDialog";
import { DocumentUpload } from "@/components/DocumentUpload";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { issuesSchema } from "@/lib/viewSchemas/registers";
import { applyFilters, applySort } from "@/lib/viewSchemas/applyFilters";
import type { ViewFilter } from "@/lib/viewSchemas/types";
import { toast } from "sonner";

interface Issue {
  id: string;
  reference_number: string | null;
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

export default function IssueRegister({ embedded = false }: { embedded?: boolean }) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { canManage } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ViewFilter[]>([]);
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" } | null>(null);

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

  const filteredIssues = (() => {
    const bySearch = issues.filter((i) =>
      !searchQuery || i.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const byFilters = applyFilters(bySearch, filters, { userId: user?.id });
    return applySort(byFilters, sort);
  })();
  const handleEditClick = (issue: Issue) => {
    setSelectedIssue(issue);
    setEditDialogOpen(true);
  };

  const content = (
    <>
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

      {/* Saved views toolbar */}
      <div className="mb-4">
        <SavedViewsBar
          scope="issues.list"
          schema={issuesSchema}
          state={{ filters: filters as any, sort }}
          onApply={(cfg) => {
            const f = cfg.filters as any;
            setFilters(Array.isArray(f) ? (f as ViewFilter[]) : []);
            setSort(cfg.sort ?? null);
          }}
          leading={
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search issues…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm bg-background"
              />
            </div>
          }
          trailing={
            <>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
              {canManage("issues") && <CreateIssueDialog onSuccess={fetchIssues} />}
            </>
          }
        />
      </div>

      {/* Issues Table */}
      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Ref</TableHead>
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
                <TableCell colSpan={7} className="text-center py-8">
                  Loading issues...
                </TableCell>
              </TableRow>
            ) : filteredIssues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
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
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {issue.reference_number || "—"}
                  </TableCell>
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
                    <div className="flex items-center gap-1">
                      <div onClick={(e) => e.stopPropagation()}>
                        <DocumentUpload
                          entityType="issue"
                          entityId={issue.id}
                          entityName={issue.title}
                          variant="icon"
                        />
                      </div>
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
                    </div>
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
    </>
  );
  if (embedded) return content;
  return (
    <AppLayout title="Issue Register" subtitle="PRINCE2 MSP issue management">
      {content}
    </AppLayout>
  );
}

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Plus, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { CreateChangeDialog } from "@/components/changeMgmt/CreateChangeDialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/10 text-info",
  in_review: "bg-warning/10 text-warning",
  cab_review: "bg-warning/10 text-warning",
  needs_information: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  scheduled: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  implemented: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

const URGENCY_STYLES: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-success/10 text-success",
};

export default function ChangeManagement() {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: changes = [], refetch, isLoading } = useQuery({
    queryKey: ["cm-requests", currentOrganization?.id, statusFilter, typeFilter],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      let q = supabase
        .from("change_management_requests")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      if (typeFilter !== "all") q = q.eq("change_type", typeFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const filtered = changes.filter((c: any) =>
    !search ||
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.reference_number?.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    pending_approval: changes.filter((c: any) => ["submitted", "in_review", "cab_review", "needs_information"].includes(c.status)).length,
    scheduled: changes.filter((c: any) => c.status === "scheduled").length,
    in_progress: changes.filter((c: any) => c.status === "in_progress").length,
    total: changes.length,
  };

  return (
    <AppLayout title="Change Management" subtitle="Operational change requests, approvals & implementation">
      <FeatureGate
        feature="feature_change_management"
        title="Change Management"
        description="Premium module: standalone operational change control with approvals, CAB workflow, and risk scoring."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Pending approval" value={stats.pending_approval} accent="warning" />
            <StatCard label="Scheduled" value={stats.scheduled} accent="primary" />
            <StatCard label="In progress" value={stats.in_progress} accent="primary" />
            <StatCard label="Total" value={stats.total} icon={<GitBranch className="h-4 w-4" />} />
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search title or reference..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.keys(STATUS_STYLES).map(s => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Change
            </Button>
          </div>

          <div className="border rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Planned start</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No change requests yet</TableCell></TableRow>
                ) : filtered.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/change-management/${c.id}`)}>
                    <TableCell className="font-mono text-xs">{c.reference_number ?? "—"}</TableCell>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell><Badge variant="outline">{c.change_type}</Badge></TableCell>
                    <TableCell><Badge className={cn(URGENCY_STYLES[c.urgency])}>{c.urgency}</Badge></TableCell>
                    <TableCell><Badge className={cn(STATUS_STYLES[c.status])}>{c.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.planned_start_at ? format(new Date(c.planned_start_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.created_at ? format(new Date(c.created_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <CreateChangeDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refetch()} />
      </FeatureGate>
    </AppLayout>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon?: React.ReactNode; accent?: "warning" | "primary" }) {
  return (
    <div className="border rounded-lg bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={cn(
        "text-2xl font-semibold mt-1",
        accent === "warning" && "text-warning",
        accent === "primary" && "text-primary",
      )}>{value}</p>
    </div>
  );
}

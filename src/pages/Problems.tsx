import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, AlertOctagon, BookOpen, Wrench, CheckCircle2 } from "lucide-react";
import { CreateProblemDialog } from "@/components/problems/CreateProblemDialog";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-info/10 text-info",
  investigating: "bg-warning/10 text-warning",
  known_error: "bg-primary/10 text-primary",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-success/10 text-success",
};

export default function Problems() {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: problems = [], isLoading } = useQuery({
    queryKey: ["problems", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("problem_summary")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const filtered = useMemo(() => {
    return problems.filter((p: any) => {
      if (statusFilter === "active" && (p.status === "closed" || p.status === "resolved")) return false;
      if (statusFilter === "known_errors" && !p.is_known_error) return false;
      if (statusFilter !== "all" && statusFilter !== "active" && statusFilter !== "known_errors" && p.status !== statusFilter) return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.reference_number?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [problems, search, statusFilter]);

  const stats = useMemo(() => ({
    open: problems.filter((p: any) => !["resolved","closed"].includes(p.status)).length,
    investigating: problems.filter((p: any) => p.status === "investigating").length,
    knownErrors: problems.filter((p: any) => p.is_known_error).length,
    resolved: problems.filter((p: any) => p.status === "resolved").length,
  }), [problems]);

  return (
    <AppLayout title="Problem Management" subtitle="Group recurring incidents, find root cause, document workarounds">
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-warning text-xs"><AlertOctagon className="h-3.5 w-3.5" /> Open problems</div>
            <div className="text-2xl font-semibold mt-1">{stats.open}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Wrench className="h-3.5 w-3.5" /> Investigating</div>
            <div className="text-2xl font-semibold mt-1">{stats.investigating}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-primary text-xs"><BookOpen className="h-3.5 w-3.5" /> Known errors</div>
            <div className="text-2xl font-semibold mt-1">{stats.knownErrors}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-success text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Resolved</div>
            <div className="text-2xl font-semibold mt-1">{stats.resolved}</div>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search problems…" className="pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active (open)</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="known_errors">Known errors only</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New problem</Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Incidents</TableHead>
                <TableHead>Identified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No problems match the filters.</TableCell></TableRow>
              ) : filtered.map((p: any) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/problems/${p.id}`)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.reference_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate max-w-[400px]">{p.title}</span>
                      {p.is_known_error && <Badge variant="outline" className="text-[10px] gap-1"><BookOpen className="h-3 w-3" /> KEDB</Badge>}
                    </div>
                    {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
                  </TableCell>
                  <TableCell><Badge className={STATUS_STYLES[p.status]}>{p.status.replace("_"," ")}</Badge></TableCell>
                  <TableCell><Badge className={PRIORITY_STYLES[p.priority]}>{p.priority}</Badge></TableCell>
                  <TableCell className="text-sm">
                    {p.linked_incident_count ?? 0}
                    {p.open_incident_count > 0 && <span className="ml-1 text-warning">({p.open_incident_count} open)</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.identified_at ? format(new Date(p.identified_at), "MMM d, yyyy") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <CreateProblemDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate(`/problems/${id}`)} />
    </AppLayout>
  );
}

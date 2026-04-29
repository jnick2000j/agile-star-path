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
import { Plus, Search, Siren, Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { DeclareMajorIncidentDialog } from "@/components/major-incidents/DeclareMajorIncidentDialog";
import { format } from "date-fns";

const SEV_STYLES: Record<string, string> = {
  sev1: "bg-destructive text-destructive-foreground",
  sev2: "bg-destructive/10 text-destructive",
  sev3: "bg-warning/10 text-warning",
  sev4: "bg-muted text-muted-foreground",
};

const STATUS_STYLES: Record<string, string> = {
  investigating: "bg-warning/10 text-warning",
  identified: "bg-info/10 text-info",
  monitoring: "bg-primary/10 text-primary",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

export default function MajorIncidents() {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["major-incidents", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("major_incidents")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("declared_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const filtered = useMemo(() => {
    return incidents.filter((i: any) => {
      if (statusFilter === "active" && (i.status === "closed" || i.status === "resolved")) return false;
      if (statusFilter !== "all" && statusFilter !== "active" && i.status !== statusFilter) return false;
      if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.reference_number?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [incidents, statusFilter, search]);

  const stats = useMemo(() => ({
    active: incidents.filter((i: any) => i.status !== "closed" && i.status !== "resolved").length,
    sev1: incidents.filter((i: any) => i.severity === "sev1" && i.status !== "closed").length,
    monitoring: incidents.filter((i: any) => i.status === "monitoring").length,
    resolved: incidents.filter((i: any) => i.status === "resolved" || i.status === "closed").length,
  }), [incidents]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Major Incidents</h1>
            <p className="text-sm text-muted-foreground">Coordinated response for high-impact incidents</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/status")}>View Status Page</Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Declare Major Incident
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <Siren className="h-8 w-8 text-destructive" />
            <div><div className="text-2xl font-bold">{stats.active}</div><div className="text-xs text-muted-foreground">Active</div></div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div><div className="text-2xl font-bold">{stats.sev1}</div><div className="text-xs text-muted-foreground">SEV1 Open</div></div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div><div className="text-2xl font-bold">{stats.monitoring}</div><div className="text-xs text-muted-foreground">Monitoring</div></div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <div><div className="text-2xl font-bold">{stats.resolved}</div><div className="text-xs text-muted-foreground">Resolved/Closed</div></div>
          </Card>
        </div>

        <Card className="p-4">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search incidents..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="identified">Identified</SelectItem>
                <SelectItem value="monitoring">Monitoring</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Declared</TableHead>
                <TableHead>Resolved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No major incidents</TableCell></TableRow>
              ) : (
                filtered.map((i: any) => (
                  <TableRow key={i.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/major-incidents/${i.id}`)}>
                    <TableCell className="font-mono text-xs">{i.reference_number}</TableCell>
                    <TableCell className="font-medium">{i.title}</TableCell>
                    <TableCell><Badge className={SEV_STYLES[i.severity]}>{i.severity.toUpperCase()}</Badge></TableCell>
                    <TableCell><Badge className={STATUS_STYLES[i.status]} variant="outline">{i.status}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(i.declared_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{i.resolved_at ? format(new Date(i.resolved_at), "MMM d, HH:mm") : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <DeclareMajorIncidentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppLayout>
  );
}

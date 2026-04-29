import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Server, Activity, AlertTriangle, ShieldAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useNavigate } from "react-router-dom";
import { CreateCIDialog } from "@/components/cmdb/CreateCIDialog";
import { CIHealthBadge } from "@/components/cmdb/CIHealthBadge";

const CRITICALITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-warning/20 text-warning",
  medium: "bg-muted text-foreground",
  low: "bg-muted/50 text-muted-foreground",
};

export default function CMDB() {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: types = [] } = useQuery({
    queryKey: ["ci-types"],
    queryFn: async () => {
      const { data } = await supabase.from("cmdb_ci_types").select("id, label, color").order("sort_order");
      return data ?? [];
    },
  });

  const { data: cis = [], isLoading } = useQuery({
    queryKey: ["cis", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("configuration_items")
        .select("id, name, reference_number, ci_type_id, status, environment, criticality, business_service, is_public_facing, cmdb_ci_types(label, color)")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: health = [] } = useQuery({
    queryKey: ["ci-health", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("cmdb_ci_health")
        .select("id, health_state, open_ticket_count, critical_ticket_count")
        .eq("organization_id", currentOrganization.id);
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const healthMap = useMemo(() => {
    const m = new Map<string, any>();
    health.forEach((h) => m.set(h.id, h));
    return m;
  }, [health]);

  const filtered = useMemo(() => {
    return cis.filter((c: any) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.reference_number?.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter !== "all" && c.ci_type_id !== typeFilter) return false;
      if (envFilter !== "all" && c.environment !== envFilter) return false;
      if (healthFilter !== "all" && healthMap.get(c.id)?.health_state !== healthFilter) return false;
      return true;
    });
  }, [cis, search, typeFilter, envFilter, healthFilter, healthMap]);

  const stats = useMemo(() => {
    const total = cis.length;
    const operational = health.filter((h) => h.health_state === "operational").length;
    const degraded = health.filter((h) => h.health_state === "degraded" || h.health_state === "partial_outage").length;
    const down = health.filter((h) => h.health_state === "major_outage").length;
    return { total, operational, degraded, down };
  }, [cis, health]);

  return (
    <AppLayout title="Configuration Management" subtitle="CMDB — services, systems, and assets that power your business">
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Server className="h-3.5 w-3.5" /> Total CIs</div>
            <div className="text-2xl font-semibold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-success text-xs"><Activity className="h-3.5 w-3.5" /> Operational</div>
            <div className="text-2xl font-semibold mt-1">{stats.operational}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-warning text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Degraded</div>
            <div className="text-2xl font-semibold mt-1">{stats.degraded}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-destructive text-xs"><ShieldAlert className="h-3.5 w-3.5" /> Major outage</div>
            <div className="text-2xl font-semibold mt-1">{stats.down}</div>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search CIs by name or reference…" className="pl-8" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={envFilter} onValueChange={setEnvFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Env" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All envs</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="test">Test</SelectItem>
              <SelectItem value="dr">DR</SelectItem>
            </SelectContent>
          </Select>
          <Select value={healthFilter} onValueChange={setHealthFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Health" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All health</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="degraded">Degraded</SelectItem>
              <SelectItem value="partial_outage">Partial outage</SelectItem>
              <SelectItem value="major_outage">Major outage</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New CI</Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CI</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Criticality</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Open tickets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No configuration items match the filters.</TableCell></TableRow>
              ) : filtered.map((c: any) => {
                const h = healthMap.get(c.id);
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/cmdb/${c.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.cmdb_ci_types?.color ?? "hsl(var(--muted-foreground))" }} />
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.reference_number}{c.business_service ? ` · ${c.business_service}` : ""}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{c.cmdb_ci_types?.label}</Badge></TableCell>
                    <TableCell className="capitalize text-sm">{c.environment ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={CRITICALITY_STYLES[c.criticality] ?? ""}>{c.criticality}</Badge>
                    </TableCell>
                    <TableCell><CIHealthBadge state={h?.health_state} /></TableCell>
                    <TableCell className="text-sm">
                      {h?.open_ticket_count ?? 0}
                      {h?.critical_ticket_count > 0 && <span className="ml-1 text-destructive">({h.critical_ticket_count} critical)</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      <CreateCIDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate(`/cmdb/${id}`)} />
    </AppLayout>
  );
}

import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Trash2, ExternalLink, Network, Activity, Ticket } from "lucide-react";
import { CIHealthBadge } from "@/components/cmdb/CIHealthBadge";
import { CIPicker } from "@/components/cmdb/CIPicker";
import { CIRelationshipGraph, type GraphCI, type GraphRel } from "@/components/cmdb/CIRelationshipGraph";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const REL_TYPES = [
  { value: "depends_on", label: "Depends on" },
  { value: "runs_on", label: "Runs on" },
  { value: "uses", label: "Uses" },
  { value: "connects_to", label: "Connects to" },
  { value: "owned_by", label: "Owned by" },
  { value: "part_of", label: "Part of" },
];

export default function CMDBDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [relType, setRelType] = useState<string>("depends_on");

  const { data: ci } = useQuery({
    queryKey: ["ci", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuration_items")
        .select("*, cmdb_ci_types(label, color, icon, category)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: health } = useQuery({
    queryKey: ["ci-health-one", id],
    queryFn: async () => {
      const { data } = await supabase.from("cmdb_ci_health").select("*").eq("id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: rels = [] } = useQuery({
    queryKey: ["ci-rels", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ci_relationships")
        .select("id, source_ci_id, target_ci_id, relationship_type")
        .or(`source_ci_id.eq.${id},target_ci_id.eq.${id}`);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const neighborIds = useMemo(() => {
    const s = new Set<string>();
    rels.forEach((r: any) => {
      if (r.source_ci_id !== id) s.add(r.source_ci_id);
      if (r.target_ci_id !== id) s.add(r.target_ci_id);
    });
    return Array.from(s);
  }, [rels, id]);

  const { data: neighbors = [] } = useQuery({
    queryKey: ["ci-neighbors", neighborIds.join(",")],
    queryFn: async () => {
      if (neighborIds.length === 0) return [];
      const { data } = await supabase
        .from("configuration_items")
        .select("id, name, reference_number, environment, criticality, cmdb_ci_types(label, color)")
        .in("id", neighborIds);
      const ids = (data ?? []).map((c: any) => c.id);
      let healthMap: Record<string, string> = {};
      if (ids.length) {
        const { data: h } = await supabase.from("cmdb_ci_health").select("id, health_state").in("id", ids);
        (h ?? []).forEach((row: any) => { healthMap[row.id] = row.health_state; });
      }
      return (data ?? []).map((c: any) => ({ ...c, health_state: healthMap[c.id] }));
    },
    enabled: neighborIds.length > 0,
  });

  const { data: blast = [] } = useQuery({
    queryKey: ["ci-blast", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ci_blast_radius", { _ci_id: id!, _max_depth: 5 });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["ci-tickets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ci_ticket_links")
        .select("id, link_type, helpdesk_tickets!inner(id, reference_number, subject, status, priority)")
        .eq("ci_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const handleAddRel = async (targetId: string) => {
    if (!currentOrganization?.id || !id) return;
    const { error } = await supabase.from("ci_relationships").insert({
      organization_id: currentOrganization.id,
      source_ci_id: id,
      target_ci_id: targetId,
      relationship_type: relType,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Relationship already exists" : error.message);
      return;
    }
    toast.success("Relationship added");
    qc.invalidateQueries({ queryKey: ["ci-rels", id] });
  };

  const handleRemoveRel = async (relId: string) => {
    const { error } = await supabase.from("ci_relationships").delete().eq("id", relId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ci-rels", id] });
  };

  if (!ci) return <AppLayout title="Configuration Item"><div className="text-muted-foreground">Loading…</div></AppLayout>;

  // graph data
  const ciMap = new Map<string, GraphCI>();
  ciMap.set(ci.id, {
    id: ci.id, name: ci.name, reference_number: ci.reference_number,
    ci_type_label: (ci as any).cmdb_ci_types?.label, color: (ci as any).cmdb_ci_types?.color,
    health_state: health?.health_state,
  });
  neighbors.forEach((n: any) => {
    ciMap.set(n.id, {
      id: n.id, name: n.name, reference_number: n.reference_number,
      ci_type_label: n.cmdb_ci_types?.label, color: n.cmdb_ci_types?.color,
      health_state: n.health_state,
    });
  });

  return (
    <AppLayout title={ci.name} subtitle={ci.reference_number ?? "Configuration item"}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/cmdb")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline">{(ci as any).cmdb_ci_types?.label}</Badge>
            {ci.environment && <Badge variant="secondary" className="capitalize">{ci.environment}</Badge>}
            <Badge variant="secondary" className="capitalize">{ci.criticality}</Badge>
            <CIHealthBadge state={health?.health_state} />
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="graph"><Network className="h-3.5 w-3.5 mr-1" /> Relationships</TabsTrigger>
            <TabsTrigger value="blast"><Activity className="h-3.5 w-3.5 mr-1" /> Blast radius</TabsTrigger>
            <TabsTrigger value="tickets"><Ticket className="h-3.5 w-3.5 mr-1" /> Tickets ({tickets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <Field label="Status" value={ci.status} />
                <Field label="Lifecycle" value={ci.lifecycle_state} />
                <Field label="Environment" value={ci.environment ?? "—"} />
                <Field label="Criticality" value={ci.criticality} />
                <Field label="Owner team" value={ci.owner_team ?? "—"} />
                <Field label="Vendor" value={ci.vendor ?? "—"} />
                <Field label="Location" value={ci.location ?? "—"} />
                <Field label="Cost center" value={ci.cost_center ?? "—"} />
                <Field label="Business service" value={ci.business_service ?? "—"} />
                <Field label="Public-facing" value={ci.is_public_facing ? "Yes" : "No"} />
              </div>
              {ci.description && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Description</div>
                  <p className="text-sm whitespace-pre-wrap">{ci.description}</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="graph" className="space-y-3">
            <div className="flex items-center gap-2">
              <Select value={relType} onValueChange={setRelType}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <CIPicker excludeIds={[ci.id, ...neighborIds]} onSelect={handleAddRel} triggerLabel="Add relationship" />
            </div>
            <CIRelationshipGraph
              rootId={ci.id}
              cis={Array.from(ciMap.values())}
              relationships={rels as GraphRel[]}
              onSelect={(nid) => { if (nid !== ci.id) navigate(`/cmdb/${nid}`); }}
            />
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-2">All relationships ({rels.length})</div>
              <div className="space-y-1">
                {rels.length === 0 && <p className="text-sm text-muted-foreground">No relationships yet.</p>}
                {rels.map((r: any) => {
                  const otherId = r.source_ci_id === ci.id ? r.target_ci_id : r.source_ci_id;
                  const other = ciMap.get(otherId);
                  const dir = r.source_ci_id === ci.id ? "→" : "←";
                  return (
                    <div key={r.id} className="flex items-center gap-2 text-sm py-1">
                      <span className="text-muted-foreground">{dir}</span>
                      <Badge variant="outline" className="capitalize text-xs">{r.relationship_type.replace(/_/g, " ")}</Badge>
                      <Link to={`/cmdb/${otherId}`} className="hover:underline flex-1 truncate">{other?.name ?? otherId}</Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemoveRel(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="blast">
            <Card className="p-4">
              <h3 className="font-semibold mb-1">Blast radius</h3>
              <p className="text-xs text-muted-foreground mb-3">Downstream CIs that depend on this item, with current open ticket counts.</p>
              {blast.length === 0 ? (
                <p className="text-sm text-muted-foreground">No downstream impact detected.</p>
              ) : (
                <div className="space-y-1">
                  {blast.map((b: any) => (
                    <Link to={`/cmdb/${b.ci_id}`} key={b.ci_id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted">
                      <Badge variant="outline" className="text-[10px]">depth {b.depth}</Badge>
                      <span className="flex-1 truncate font-medium">{b.ci_name}</span>
                      <span className="text-xs text-muted-foreground">{b.reference_number}</span>
                      {b.open_incidents > 0 && (
                        <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                          {b.open_incidents} open
                        </Badge>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="tickets">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Linked tickets</h3>
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets linked.</p>
              ) : (
                <div className="space-y-1">
                  {tickets.map((t: any) => (
                    <Link to={`/support/tickets/${t.helpdesk_tickets.id}`} key={t.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted">
                      <span className="text-xs text-muted-foreground w-24">{t.helpdesk_tickets.reference_number}</span>
                      <span className="flex-1 truncate">{t.helpdesk_tickets.subject}</span>
                      <Badge variant="outline" className="capitalize text-xs">{t.link_type.replace("_", " ")}</Badge>
                      <Badge variant="secondary" className="capitalize text-xs">{t.helpdesk_tickets.status}</Badge>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm capitalize">{value}</div>
    </div>
  );
}

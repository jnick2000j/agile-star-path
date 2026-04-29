import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Server, Link2Off, AlertTriangle } from "lucide-react";
import { CIPicker } from "./CIPicker";
import { CIHealthBadge } from "./CIHealthBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useState } from "react";

interface Props {
  ticketId: string;
}

const LINK_TYPES = [
  { value: "affected", label: "Affected" },
  { value: "related", label: "Related" },
  { value: "root_cause", label: "Root cause" },
  { value: "impacted_downstream", label: "Downstream" },
];

export function LinkedCIsPanel({ ticketId }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [linkType, setLinkType] = useState<string>("affected");

  const { data: links = [] } = useQuery({
    queryKey: ["ci-ticket-links", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ci_ticket_links")
        .select("id, link_type, ci_id, configuration_items!inner(id, name, reference_number, environment, criticality), cmdb_ci_health:configuration_items!inner(id)")
        .eq("ticket_id", ticketId);
      if (error) throw error;
      // fetch health for each ci in one round-trip
      const ciIds = (data ?? []).map((l: any) => l.ci_id);
      let health: Record<string, string> = {};
      if (ciIds.length) {
        const { data: h } = await supabase
          .from("cmdb_ci_health")
          .select("id, health_state")
          .in("id", ciIds);
        (h ?? []).forEach((row: any) => { health[row.id] = row.health_state; });
      }
      return (data ?? []).map((l: any) => ({ ...l, health_state: health[l.ci_id] }));
    },
    enabled: !!ticketId,
  });

  const handleLink = async (ciId: string) => {
    if (!currentOrganization?.id) return;
    const { error } = await supabase.from("ci_ticket_links").insert({
      organization_id: currentOrganization.id,
      ci_id: ciId,
      ticket_id: ticketId,
      link_type: linkType,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Already linked with this type" : error.message);
      return;
    }
    toast.success("CI linked");
    qc.invalidateQueries({ queryKey: ["ci-ticket-links", ticketId] });
  };

  const handleUnlink = async (linkId: string) => {
    const { error } = await supabase.from("ci_ticket_links").delete().eq("id", linkId);
    if (error) { toast.error(error.message); return; }
    toast.success("Unlinked");
    qc.invalidateQueries({ queryKey: ["ci-ticket-links", ticketId] });
  };

  const linkedIds = links.map((l: any) => l.ci_id);
  const hasOutage = links.some((l: any) => l.health_state === "major_outage" || l.health_state === "partial_outage");

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Configuration items</h3>
          <Badge variant="secondary" className="text-xs">{links.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={linkType} onValueChange={setLinkType}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LINK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <CIPicker excludeIds={linkedIds} onSelect={handleLink} triggerLabel="Link" />
        </div>
      </div>

      {hasOutage && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          One or more linked CIs are currently degraded or down.
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground">No configuration items linked yet.</p>
      ) : (
        <div className="space-y-1.5">
          {links.map((l: any) => (
            <div key={l.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
              <div className="flex-1 min-w-0">
                <Link to={`/cmdb/${l.ci_id}`} className="text-sm font-medium hover:underline truncate block">
                  {l.configuration_items?.name}
                </Link>
                <div className="text-[11px] text-muted-foreground truncate">
                  {l.configuration_items?.reference_number}
                  {l.configuration_items?.environment ? ` · ${l.configuration_items.environment}` : ""}
                  {` · ${l.configuration_items?.criticality}`}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize">{l.link_type.replace("_", " ")}</Badge>
              <CIHealthBadge state={l.health_state} />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUnlink(l.id)}>
                <Link2Off className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, AlertOctagon, Wrench, Activity } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_META: Record<string, { label: string; icon: any; color: string }> = {
  operational: { label: "Operational", icon: CheckCircle2, color: "text-success" },
  degraded: { label: "Degraded", icon: Activity, color: "text-warning" },
  partial_outage: { label: "Partial Outage", icon: AlertTriangle, color: "text-warning" },
  major_outage: { label: "Major Outage", icon: AlertOctagon, color: "text-destructive" },
  maintenance: { label: "Maintenance", icon: Wrench, color: "text-info" },
};

const IMPACT_STYLES: Record<string, string> = {
  none: "bg-muted",
  minor: "bg-info/10 text-info",
  major: "bg-warning/10 text-warning",
  critical: "bg-destructive text-destructive-foreground",
};

export default function StatusPagePublic() {
  const [email, setEmail] = useState("");

  const { data: components = [] } = useQuery({
    queryKey: ["public-status-components"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("status_page_components")
        .select("*")
        .eq("is_public", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["public-status-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("status_page_incidents")
        .select("*, status_page_incident_updates(id, status, message, created_at)")
        .eq("is_published", true)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const subscribe = useMutation({
    mutationFn: async () => {
      const orgId = components[0]?.organization_id;
      if (!orgId) throw new Error("No status page configured");
      const { error } = await supabase.from("status_page_subscribers").insert({
        organization_id: orgId,
        email,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscribed! You'll be notified of incidents.");
      setEmail("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const overall = components.every((c: any) => c.current_status === "operational")
    ? "All Systems Operational"
    : components.some((c: any) => c.current_status === "major_outage")
    ? "Major Outage"
    : components.some((c: any) => ["partial_outage", "degraded"].includes(c.current_status))
    ? "Partial System Outage"
    : "All Systems Operational";

  const overallColor = overall === "All Systems Operational" ? "text-success" : overall === "Major Outage" ? "text-destructive" : "text-warning";

  // Group by group_name
  const grouped = components.reduce((acc: any, c: any) => {
    const g = c.group_name || "Services";
    (acc[g] = acc[g] || []).push(c);
    return acc;
  }, {});

  const activeIncidents = incidents.filter((i: any) => i.status !== "resolved");
  const recentIncidents = incidents.filter((i: any) => i.status === "resolved").slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="text-center py-8">
          <h1 className="text-3xl font-bold mb-2">Service Status</h1>
          <div className={`text-2xl font-semibold ${overallColor}`}>{overall}</div>
        </div>

        {activeIncidents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Active Incidents</h2>
            {activeIncidents.map((i: any) => (
              <Card key={i.id} className="p-4 border-l-4 border-l-destructive">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{i.title}</div>
                  <Badge className={IMPACT_STYLES[i.impact]}>{i.impact}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-3">Started {format(new Date(i.started_at), "PPp")}</div>
                <div className="space-y-2">
                  {(i.status_page_incident_updates ?? []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((u: any) => (
                    <div key={u.id} className="text-sm border-l-2 pl-3">
                      <div className="font-medium capitalize">{u.status}</div>
                      <div>{u.message}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(u.created_at), "PPp")}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="p-4 space-y-4">
          {Object.entries(grouped).map(([group, items]: any) => (
            <div key={group}>
              <h3 className="font-semibold text-sm mb-2">{group}</h3>
              <div className="space-y-2">
                {items.map((c: any) => {
                  const meta = STATUS_META[c.current_status] ?? STATUS_META.operational;
                  const Icon = meta.icon;
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                      </div>
                      <div className={`flex items-center gap-2 text-sm ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {components.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No status components configured</p>}
        </Card>

        {recentIncidents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Past Incidents</h2>
            {recentIncidents.map((i: any) => (
              <Card key={i.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{i.title}</div>
                  <Badge variant="outline">Resolved</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(i.started_at), "PP")} {i.resolved_at && `– ${format(new Date(i.resolved_at), "PP")}`}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Subscribe to Updates</h3>
          <p className="text-xs text-muted-foreground mb-3">Get notified by email when incidents are reported or resolved.</p>
          <div className="flex gap-2">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <Button onClick={() => subscribe.mutate()} disabled={!email || subscribe.isPending}>Subscribe</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

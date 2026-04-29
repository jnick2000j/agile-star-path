import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { formatLabel } from "@/lib/utils";

interface Props {
  entityType: "helpdesk_ticket" | "helpdesk_comment" | "cm_request" | "cm_approval";
  entityId: string;
  title?: string;
}

const ACTION_META: Record<string, { icon: any; color: string; label: string }> = {
  created: { icon: Plus, color: "bg-success/10 text-success", label: "Created" },
  updated: { icon: Pencil, color: "bg-info/10 text-info", label: "Updated" },
  deleted: { icon: Trash2, color: "bg-destructive/10 text-destructive", label: "Deleted" },
};

function renderValue(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

export function EntityAuditTrail({ entityType, entityId, title = "Audit Trail" }: Props) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_audit_log")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!entityId,
  });

  const actorIds = Array.from(new Set(entries.map((e: any) => e.actor_user_id).filter(Boolean)));
  const { data: actors = [] } = useQuery({
    queryKey: ["audit-actors", actorIds.sort().join(",")],
    queryFn: async () => {
      if (actorIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", actorIds);
      return data ?? [];
    },
    enabled: actorIds.length > 0,
  });

  const actorName = (id: string | null) => {
    if (!id) return "System";
    const a = (actors as any[]).find(x => x.user_id === id);
    if (!a) return "Unknown";
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
    return name || a.email || "Unknown";
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <History className="h-4 w-4" /> {title}
          {entries.length > 0 && <Badge variant="secondary">{entries.length}</Badge>}
        </h3>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit entries yet.</p>
      ) : (
        <ScrollArea className="max-h-96 pr-2">
          <div className="space-y-3">
            {entries.map((e: any) => {
              const meta = ACTION_META[e.action] ?? ACTION_META.updated;
              const Icon = meta.icon;
              return (
                <div key={e.id} className="flex gap-3 text-sm border-l-2 border-muted pl-3 py-1">
                  <div className={`h-7 w-7 rounded-full ${meta.color} flex items-center justify-center shrink-0`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium">
                        {meta.label} by <span className="text-foreground">{actorName(e.actor_user_id)}</span>
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(e.created_at), "PPp")}
                      </span>
                    </div>
                    {e.action === "updated" && e.changed_fields?.length > 0 && (
                      <div className="space-y-1">
                        {e.changed_fields.slice(0, 8).map((f: string) => (
                          <div key={f} className="text-xs flex items-baseline gap-2 flex-wrap">
                            <span className="text-muted-foreground">{formatLabel(f)}:</span>
                            <Badge variant="outline" className="font-normal text-xs">
                              {renderValue(e.before_data?.[f]).slice(0, 60)}
                            </Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="secondary" className="font-normal text-xs">
                              {renderValue(e.after_data?.[f]).slice(0, 60)}
                            </Badge>
                          </div>
                        ))}
                        {e.changed_fields.length > 8 && (
                          <p className="text-xs text-muted-foreground">+ {e.changed_fields.length - 8} more fields</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}

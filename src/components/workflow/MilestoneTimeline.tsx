import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  History,
  MessageSquare,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface MilestoneTimelineProps {
  milestoneId: string;
}

interface HistoryEntry {
  id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
  actor?: { full_name: string | null; email: string | null } | null;
}

const eventConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  created: { label: "Created", icon: Sparkles, color: "text-primary" },
  status_change: { label: "Status changed", icon: Activity, color: "text-primary" },
  owner_change: { label: "Owner changed", icon: User, color: "text-info" },
  target_date_revised: { label: "Target date revised", icon: CalendarClock, color: "text-warning" },
  document_linked: { label: "Document attached", icon: FileText, color: "text-success" },
  document_unlinked: { label: "Document removed", icon: XCircle, color: "text-destructive" },
  comment: { label: "Comment", icon: MessageSquare, color: "text-muted-foreground" },
};

export function MilestoneTimeline({ milestoneId }: MilestoneTimelineProps) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["milestone-history", milestoneId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestone_history")
        .select("*")
        .eq("milestone_id", milestoneId)
        .order("changed_at", { ascending: false });
      if (error) throw error;

      const actorIds = Array.from(
        new Set((data || []).map((d: any) => d.changed_by).filter(Boolean))
      ) as string[];

      let actors: Record<string, { full_name: string | null; email: string | null }> = {};
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", actorIds);
        actors = (profiles || []).reduce((acc: any, p: any) => {
          acc[p.user_id] = { full_name: p.full_name, email: p.email };
          return acc;
        }, {});
      }

      return (data as HistoryEntry[]).map((e) => ({
        ...e,
        actor: e.changed_by ? actors[e.changed_by] || null : null,
      }));
    },
    enabled: !!milestoneId,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Loading timeline…</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center">
        <History className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const cfg = eventConfig[entry.event_type] || eventConfig.comment;
        const Icon = cfg.icon;
        const actorName =
          entry.actor?.full_name || entry.actor?.email || "Unknown user";

        return (
          <div
            key={entry.id}
            className="flex gap-3 rounded-md border bg-card p-3"
          >
            <div className={`mt-0.5 ${cfg.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  {cfg.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  by {actorName}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {format(parseISO(entry.changed_at), "MMM d, yyyy 'at' HH:mm")}
                </span>
              </div>

              {entry.event_type === "status_change" && (
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Badge variant="secondary" className="capitalize">
                    {entry.from_value || "—"}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge className="capitalize">{entry.to_value || "—"}</Badge>
                </div>
              )}

              {entry.event_type === "target_date_revised" && (
                <div className="text-sm mt-1">
                  <span className="text-muted-foreground line-through">
                    {entry.from_value || "—"}
                  </span>
                  <ArrowRight className="inline h-3 w-3 mx-2 text-muted-foreground" />
                  <span className="font-medium">{entry.to_value || "—"}</span>
                </div>
              )}

              {entry.event_type === "owner_change" && (
                <p className="text-sm text-muted-foreground mt-1">
                  Ownership reassigned
                </p>
              )}

              {(entry.event_type === "document_linked" ||
                entry.event_type === "document_unlinked") && (
                <p className="text-sm mt-1 truncate">
                  <FileText className="inline h-3 w-3 mr-1 text-muted-foreground" />
                  {entry.to_value || entry.from_value || "Document"}
                </p>
              )}

              {entry.comment && entry.event_type !== "target_date_revised" && (
                <p className="text-sm bg-muted/50 rounded p-2 mt-2">
                  {entry.comment}
                </p>
              )}
              {entry.event_type === "target_date_revised" && entry.comment && (
                <p className="text-sm bg-muted/50 rounded p-2 mt-2">
                  <strong>Reason:</strong> {entry.comment}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

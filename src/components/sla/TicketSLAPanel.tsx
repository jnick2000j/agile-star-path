import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Props {
  ticket: any;
}

function getCountdown(dueAt: string | null, completedAt: string | null) {
  if (!dueAt) return null;
  if (completedAt) {
    const onTime = new Date(completedAt) <= new Date(dueAt);
    return { state: onTime ? "met" : "breached", label: onTime ? "Met" : "Breached", due: dueAt };
  }
  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  if (diffMs <= 0) return { state: "breached", label: `Breached ${formatDistanceToNow(due)} ago`, due: dueAt };
  if (diffMs <= 30 * 60 * 1000) return { state: "warning", label: `Due in ${formatDistanceToNow(due)}`, due: dueAt };
  return { state: "ok", label: `Due in ${formatDistanceToNow(due)}`, due: dueAt };
}

const STATE_STYLES: Record<string, string> = {
  ok: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  breached: "bg-destructive text-destructive-foreground",
  met: "bg-success/10 text-success",
};

export function TicketSLAPanel({ ticket }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const response = getCountdown(ticket.sla_response_due_at, ticket.first_response_at);
  const resolution = getCountdown(ticket.sla_resolution_due_at, ticket.resolved_at);

  const { data: events = [] } = useQuery({
    queryKey: ["ticket-esc-events", ticket.id, tick],
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_escalation_events")
        .select("*, helpdesk_escalation_rules(name)")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (!ticket.sla_response_due_at && !ticket.sla_resolution_due_at) {
    return (
      <Card className="p-4">
        <h3 className="font-semibold flex items-center gap-2 mb-2"><Clock className="h-4 w-4" /> SLA</h3>
        <p className="text-xs text-muted-foreground">No SLA policy applied</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> SLA</h3>

      {response && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">First Response</span>
            <Badge className={STATE_STYLES[response.state]} variant="outline">
              {response.state === "met" && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {response.state === "breached" && <AlertTriangle className="h-3 w-3 mr-1" />}
              {response.label}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">Due: {format(new Date(response.due), "PPp")}</div>
        </div>
      )}

      {resolution && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Resolution</span>
            <Badge className={STATE_STYLES[resolution.state]} variant="outline">
              {resolution.state === "met" && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {resolution.state === "breached" && <AlertTriangle className="h-3 w-3 mr-1" />}
              {resolution.label}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">Due: {format(new Date(resolution.due), "PPp")}</div>
        </div>
      )}

      {events.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-xs font-medium mb-2 flex items-center gap-1"><Zap className="h-3 w-3" /> Escalations</div>
          <div className="space-y-1">
            {events.map((e: any) => (
              <div key={e.id} className="text-xs">
                <span className="font-medium">{e.helpdesk_escalation_rules?.name ?? "Rule"}</span>
                <span className="text-muted-foreground"> · {e.action} · {formatDistanceToNow(new Date(e.created_at))} ago</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LifeBuoy, ExternalLink, Plus } from "lucide-react";
import { format } from "date-fns";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { cn } from "@/lib/utils";

interface EntityTicketsCardProps {
  scope: "project" | "programme" | "product";
  entityId: string;
  entityName?: string;
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-info/10 text-info",
  open: "bg-primary/10 text-primary",
  pending: "bg-warning/10 text-warning",
  on_hold: "bg-muted text-muted-foreground",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export function EntityTicketsCard({ scope, entityId, entityName }: EntityTicketsCardProps) {
  const navigate = useNavigate();
  const column = `${scope}_id`;

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["entity-tickets", scope, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select("id, reference_number, subject, status, priority, ticket_type, assignee_id, created_at, sla_resolution_due_at, sla_resolution_breached")
        .eq(column, entityId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!entityId,
  });

  return (
    <FeatureGate feature="feature_helpdesk" silent>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5" /> Helpdesk Tickets
              </CardTitle>
              <CardDescription>
                Support, incident, and service requests linked to this {scope}
                {entityName ? ` (${entityName})` : ""}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/support")}>
              <Plus className="h-4 w-4 mr-2" /> New Ticket
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No tickets linked to this {scope} yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t: any) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/support/${t.id}`)}>
                    <TableCell className="font-mono text-xs">{t.reference_number ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{t.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{t.ticket_type.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{t.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", STATUS_STYLES[t.status])}>
                        {t.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.sla_resolution_breached ? (
                        <Badge variant="destructive" className="text-xs">Breached</Badge>
                      ) : t.sla_resolution_due_at ? (
                        <span className="text-xs text-muted-foreground">
                          due {format(new Date(t.sla_resolution_due_at), "MMM d, p")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </FeatureGate>
  );
}

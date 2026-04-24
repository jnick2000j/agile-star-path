import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GitPullRequest, ExternalLink, Plus } from "lucide-react";
import { format } from "date-fns";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { cn } from "@/lib/utils";

interface EntityChangesCardProps {
  scope: "project" | "programme" | "product";
  entityId: string;
  entityName?: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/10 text-info",
  in_review: "bg-info/10 text-info",
  cab_review: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  scheduled: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  implemented: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

const IMPACT_STYLES: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-warning/15 text-warning",
  medium: "bg-info/15 text-info",
  low: "bg-muted text-muted-foreground",
};

export function EntityChangesCard({
  scope,
  entityId,
  entityName,
}: EntityChangesCardProps) {
  const navigate = useNavigate();
  const column = `${scope}_id`;

  const { data: changes = [], isLoading } = useQuery({
    queryKey: ["entity-changes", scope, entityId],
    queryFn: async () => {
      const query = supabase
        .from("change_management_requests")
        .select(
          "id, reference_number, title, status, impact, urgency, change_type, planned_start_at, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(50);
      const { data, error } = await (query as any).eq(column, entityId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!entityId,
  });

  return (
    <FeatureGate feature="feature_change_management" silent>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitPullRequest className="h-5 w-5" /> Change Requests
              </CardTitle>
              <CardDescription>
                Change requests linked to this {scope}
                {entityName ? ` (${entityName})` : ""}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/change-management")}
            >
              <Plus className="h-4 w-4 mr-2" /> New Change
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading changes...</p>
          ) : changes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No change requests linked to this {scope} yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((c: any) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/change-management/${c.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {c.reference_number ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{c.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {String(c.change_type).replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-xs capitalize", IMPACT_STYLES[c.impact] || "")}
                      >
                        {c.impact}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs capitalize", STATUS_STYLES[c.status] || "")}>
                        {String(c.status).replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.planned_start_at
                        ? format(new Date(c.planned_start_at), "MMM d, yyyy")
                        : "—"}
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

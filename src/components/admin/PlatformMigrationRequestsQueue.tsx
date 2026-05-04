import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  PlayCircle,
} from "lucide-react";

interface MigrationRequest {
  id: string;
  organization_id: string;
  organization_name?: string;
  requested_by: string;
  source_system: string;
  source_details: string | null;
  scope: string | null;
  expected_record_count: number | null;
  contact_email: string | null;
  notes: string | null;
  status: string;
  provisioning_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
}

type ActionType = "approve" | "in_progress" | "complete" | "reject";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  rejected: "Rejected",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  in_progress: "bg-info/10 text-info border-info/20",
  completed: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

export function PlatformMigrationRequestsQueue() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MigrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MigrationRequest | null>(null);
  const [provisioningNotes, setProvisioningNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("migration_requests")
        .select("*, organizations(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const enriched = (data || []).map((r: any) => ({
        ...r,
        organization_name: r.organizations?.name,
      }));
      setRequests(enriched);
    } catch (e) {
      console.error("migration queue fetch error:", e);
      toast.error("Failed to load migration requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (selected) setProvisioningNotes(selected.provisioning_notes ?? "");
  }, [selected]);

  const handleAction = async (action: ActionType) => {
    if (!selected || !user) return;
    if (action === "reject" && !provisioningNotes.trim()) {
      toast.error("Reason required to reject");
      return;
    }
    setSubmitting(true);
    try {
      const newStatus =
        action === "approve" ? "in_progress"
        : action === "in_progress" ? "in_progress"
        : action === "complete" ? "completed"
        : "rejected";

      const update: Record<string, any> = {
        status: newStatus,
        provisioning_notes: provisioningNotes.trim() || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };
      if (action === "complete") update.completed_at = new Date().toISOString();

      const { error } = await (supabase as any)
        .from("migration_requests")
        .update(update)
        .eq("id", selected.id);
      if (error) throw error;

      toast.success(
        action === "approve" || action === "in_progress" ? "Marked in progress" :
        action === "complete" ? "Marked completed" :
        "Request rejected",
      );
      setSelected(null);
      setProvisioningNotes("");
      fetchRequests();
    } catch (e: any) {
      console.error("migration action error:", e);
      toast.error(e.message || "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const filterByStatus = (status: string) =>
    status === "all" ? requests : requests.filter((r) => r.status === status);

  const renderTable = (rows: MigrationRequest[]) => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No migration requests in this category.
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Records</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.organization_name || "—"}</TableCell>
              <TableCell className="capitalize text-sm">{r.source_system.replace("_", " ")}</TableCell>
              <TableCell className="text-sm">{r.expected_record_count ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className={`capitalize ${STATUS_BADGE[r.status] ?? ""}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(r.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => setSelected(r)}>
                  <Eye className="h-4 w-4 mr-1" /> Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const inProgressCount = requests.filter((r) => r.status === "in_progress").length;

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Migration Requests Queue</h2>
            <p className="text-sm text-muted-foreground">
              Review tenant data-migration requests, then run the import from the Migrations tab.
            </p>
          </div>
          {pendingCount > 0 && (
            <Badge className="bg-warning/10 text-warning border-warning/20" variant="outline">
              {pendingCount} pending
            </Badge>
          )}
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending {pendingCount > 0 && `(${pendingCount})`}
            </TabsTrigger>
            <TabsTrigger value="in_progress">
              In progress {inProgressCount > 0 && `(${inProgressCount})`}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">{renderTable(filterByStatus("pending"))}</TabsContent>
          <TabsContent value="in_progress" className="mt-4">{renderTable(filterByStatus("in_progress"))}</TabsContent>
          <TabsContent value="completed" className="mt-4">{renderTable(filterByStatus("completed"))}</TabsContent>
          <TabsContent value="rejected" className="mt-4">{renderTable(filterByStatus("rejected"))}</TabsContent>
          <TabsContent value="all" className="mt-4">{renderTable(requests)}</TabsContent>
        </Tabs>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Migration request — {selected?.organization_name}
            </DialogTitle>
            <DialogDescription>
              Coordinate with the requester, then run the actual import from the Migrations tab.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Source system</Label>
                  <p className="text-sm capitalize mt-1">{selected.source_system.replace("_", " ")}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Expected records</Label>
                  <p className="text-sm mt-1">{selected.expected_record_count ?? "—"}</p>
                </div>
              </div>

              {selected.source_details && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Source details</Label>
                  <p className="text-sm bg-muted/50 p-2 rounded mt-1 break-all">{selected.source_details}</p>
                </div>
              )}

              {selected.scope && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Scope</Label>
                  <p className="text-sm bg-muted/50 p-2 rounded mt-1 whitespace-pre-wrap">{selected.scope}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Contact email</Label>
                  <p className="text-sm mt-1">{selected.contact_email ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Status</Label>
                  <Badge variant="outline" className={`capitalize text-xs mt-1 ${STATUS_BADGE[selected.status] ?? ""}`}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </Badge>
                </div>
              </div>

              {selected.notes && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Customer notes</Label>
                  <p className="text-sm bg-muted/50 p-2 rounded mt-1 whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="prov-notes">Platform notes (visible to requester)</Label>
                <Textarea
                  id="prov-notes"
                  placeholder="Required when rejecting. Used to share progress, ETAs, or reasons."
                  value={provisioningNotes}
                  onChange={(e) => setProvisioningNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {selected.status === "pending" && (
                  <>
                    <Button variant="destructive" onClick={() => handleAction("reject")} disabled={submitting}>
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                    <Button onClick={() => handleAction("approve")} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                      Accept &amp; mark in progress
                    </Button>
                  </>
                )}
                {selected.status === "in_progress" && (
                  <>
                    <Button variant="outline" onClick={() => handleAction("in_progress")} disabled={submitting}>
                      Save notes
                    </Button>
                    <Button onClick={() => handleAction("complete")} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Mark completed
                    </Button>
                  </>
                )}
                {(selected.status === "completed" || selected.status === "rejected") && (
                  <Button variant="outline" onClick={() => handleAction("in_progress")} disabled={submitting}>
                    Save notes
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

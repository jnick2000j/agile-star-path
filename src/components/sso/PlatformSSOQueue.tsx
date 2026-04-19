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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShieldCheck, CheckCircle2, XCircle, Eye, Loader2, Copy } from "lucide-react";

interface SSORequest {
  id: string;
  organization_id: string;
  organization_name?: string;
  metadata_url: string | null;
  allowed_domains: string[];
  default_access_level: string;
  status: string;
  notes: string | null;
  provisioning_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  activated_at: string | null;
}

export function PlatformSSOQueue() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SSORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SSORequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [provisioningNotes, setProvisioningNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sso_configurations")
        .select("*, organizations(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((r: any) => ({
        ...r,
        organization_name: r.organizations?.name,
      }));
      setRequests(enriched);
    } catch (e) {
      console.error("SSO queue fetch error:", e);
      toast.error("Failed to load SSO requests");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selected || !actionType || !user) return;
    setSubmitting(true);

    const newStatus = actionType === "approve" ? "active" : "rejected";

    try {
      const { error } = await supabase
        .from("sso_configurations")
        .update({
          status: newStatus,
          provisioning_notes: provisioningNotes.trim() || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          activated_at: actionType === "approve" ? new Date().toISOString() : null,
        })
        .eq("id", selected.id);

      if (error) throw error;

      // Audit log
      await supabase.rpc("log_audit_event", {
        _event_type: actionType === "approve" ? "sso_config_approved" : "sso_config_rejected",
        _event_category: "sso",
        _organization_id: selected.organization_id,
        _target_entity_type: "sso_configuration",
        _target_entity_id: selected.id,
        _metadata: { provisioning_notes: provisioningNotes.trim() || null },
      });

      // Notify the requester
      try {
        await supabase.from("notifications").insert({
          user_id: user.id, // will be overridden via RPC ideally; fallback notif here
          type: "sso_status_change",
          title: actionType === "approve" ? "SSO is now active" : "SSO request needs attention",
          message:
            actionType === "approve"
              ? `SAML SSO has been activated for ${selected.organization_name}.`
              : `Your SSO request for ${selected.organization_name} was rejected. ${provisioningNotes || ""}`,
        });
      } catch {
        // best-effort
      }

      toast.success(
        actionType === "approve" ? "SSO config activated" : "SSO config rejected",
      );
      setSelected(null);
      setActionType(null);
      setProvisioningNotes("");
      fetchRequests();
    } catch (e: any) {
      console.error("SSO action error:", e);
      toast.error(e.message || "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-warning/10 text-warning border-warning/20",
      active: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
      disabled: "bg-muted text-muted-foreground",
    };
    return (
      <Badge variant="outline" className={`capitalize ${map[status] || ""}`}>
        {status}
      </Badge>
    );
  };

  const filterByStatus = (status: string) =>
    status === "all" ? requests : requests.filter((r) => r.status === status);

  const renderTable = (rows: SSORequest[]) => {
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
          No SSO requests in this category.
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Domains</TableHead>
            <TableHead>Default Access</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.organization_name || "—"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {r.allowed_domains.slice(0, 2).map((d) => (
                    <Badge key={d} variant="secondary" className="text-xs">
                      {d}
                    </Badge>
                  ))}
                  {r.allowed_domains.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{r.allowed_domains.length - 2}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="capitalize text-sm">{r.default_access_level}</TableCell>
              <TableCell>{statusBadge(r.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(r.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelected(r);
                    setActionType(null);
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">SSO Provisioning Queue</h2>
            <p className="text-sm text-muted-foreground">
              Review and provision customer SAML SSO requests.
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
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            {renderTable(filterByStatus("pending"))}
          </TabsContent>
          <TabsContent value="active" className="mt-4">
            {renderTable(filterByStatus("active"))}
          </TabsContent>
          <TabsContent value="rejected" className="mt-4">
            {renderTable(filterByStatus("rejected"))}
          </TabsContent>
          <TabsContent value="all" className="mt-4">{renderTable(requests)}</TabsContent>
        </Tabs>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>SSO Request — {selected?.organization_name}</DialogTitle>
            <DialogDescription>
              Provision the SAML connection on Lovable Cloud, then approve here.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">
                  IdP Metadata URL
                </Label>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                    {selected.metadata_url}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(selected.metadata_url || "");
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Domains</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selected.allowed_domains.map((d) => (
                      <Badge key={d} variant="secondary" className="text-xs">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">
                    Default Access
                  </Label>
                  <Badge variant="outline" className="capitalize text-xs mt-1">
                    {selected.default_access_level}
                  </Badge>
                </div>
              </div>

              {selected.notes && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">
                    Customer Notes
                  </Label>
                  <p className="text-sm bg-muted/50 p-2 rounded mt-1">{selected.notes}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="prov-notes">Provisioning Notes / Reason</Label>
                <Textarea
                  id="prov-notes"
                  placeholder="Optional notes (required if rejecting)"
                  value={provisioningNotes}
                  onChange={(e) => setProvisioningNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {selected.status === "pending" && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (!provisioningNotes.trim()) {
                        toast.error("Reason required to reject");
                        return;
                      }
                      setActionType("reject");
                      handleAction();
                    }}
                    disabled={submitting}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setActionType("approve");
                      handleAction();
                    }}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Approve & Activate
                  </Button>
                </div>
              )}

              {selected.status !== "pending" && selected.provisioning_notes && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">
                    Previous Decision Notes
                  </Label>
                  <p className="text-sm bg-muted/50 p-2 rounded mt-1">
                    {selected.provisioning_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

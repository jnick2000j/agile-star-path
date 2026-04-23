import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, XCircle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["draft","submitted","in_review","cab_review","needs_information","approved","rejected","scheduled","in_progress","implemented","closed","cancelled","failed"];
const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/10 text-info",
  in_review: "bg-warning/10 text-warning",
  cab_review: "bg-warning/10 text-warning",
  needs_information: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  scheduled: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  implemented: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

export default function ChangeManagementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [newApprovalKind, setNewApprovalKind] = useState<string>("technical");
  const [newApproverId, setNewApproverId] = useState<string>("");

  const { data: change, isLoading } = useQuery({
    queryKey: ["cm-request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("change_management_requests").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["cm-approvals", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("change_management_approvals").select("*").eq("change_id", id!).order("sequence");
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["cm-activity", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("change_management_activity").select("*").eq("change_id", id!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: orgUsers = [] } = useQuery({
    queryKey: ["org-users-min", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data: access } = await supabase
        .from("user_organization_access").select("user_id")
        .eq("organization_id", currentOrganization.id);
      const ids = (access ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, full_name, email").in("user_id", ids);
      return profiles ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const updateField = async (field: string, value: any) => {
    if (!change) return;
    const prev = (change as any)[field];
    const { error } = await supabase
      .from("change_management_requests")
      .update({ [field]: value })
      .eq("id", change.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("change_management_activity").insert({
      change_id: change.id,
      organization_id: change.organization_id,
      actor_user_id: user?.id ?? null,
      event_type: `${field}_changed`,
      from_value: { [field]: prev },
      to_value: { [field]: value },
    });
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["cm-request", id] });
    qc.invalidateQueries({ queryKey: ["cm-activity", id] });
  };

  const addApproval = async () => {
    if (!change || !newApproverId) { toast.error("Select an approver"); return; }
    const { error } = await supabase.from("change_management_approvals").insert({
      change_id: change.id,
      organization_id: change.organization_id,
      approval_kind: newApprovalKind as any,
      approver_id: newApproverId,
      sequence: approvals.length + 1,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Approval added");
    setNewApproverId("");
    qc.invalidateQueries({ queryKey: ["cm-approvals", id] });
  };

  const decideApproval = async (approvalId: string, decision: "approved" | "rejected") => {
    const { error } = await supabase.from("change_management_approvals").update({
      decision,
      decided_at: new Date().toISOString(),
    }).eq("id", approvalId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${decision}`);
    qc.invalidateQueries({ queryKey: ["cm-approvals", id] });
  };

  if (isLoading || !change) {
    return <AppLayout title="Change"><div className="text-muted-foreground">Loading...</div></AppLayout>;
  }

  return (
    <AppLayout title={change.title} subtitle={change.reference_number ?? ""}>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/change-management")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{change.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {change.created_at && format(new Date(change.created_at), "PPp")}
                  </p>
                </div>
                <Badge className={cn(STATUS_STYLES[change.status])}>{change.status.replace(/_/g, " ")}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm">{change.description || <span className="text-muted-foreground">No description</span>}</p>
            </Card>

            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="approvals">Approvals ({approvals.length})</TabsTrigger>
                <TabsTrigger value="activity">Activity ({activity.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <DetailField label="Reason" value={change.reason} onSave={(v) => updateField("reason", v)} multiline />
                <DetailField label="Implementation plan" value={change.implementation_plan} onSave={(v) => updateField("implementation_plan", v)} multiline />
                <DetailField label="Rollback plan" value={change.rollback_plan} onSave={(v) => updateField("rollback_plan", v)} multiline />
                <DetailField label="Test plan" value={change.test_plan} onSave={(v) => updateField("test_plan", v)} multiline />
                <DetailField label="Communication plan" value={change.communication_plan} onSave={(v) => updateField("communication_plan", v)} multiline />
              </TabsContent>

              <TabsContent value="approvals" className="space-y-3">
                {approvals.map((a: any) => (
                  <Card key={a.id} className="p-4 flex items-center justify-between">
                    <div>
                      <Badge variant="outline">{a.approval_kind}</Badge>
                      <p className="text-sm mt-1">
                        Approver: <code className="text-xs">{a.approver_id?.slice(0, 8) ?? "—"}</code>
                      </p>
                      {a.decided_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Decided {format(new Date(a.decided_at), "PPp")}
                        </p>
                      )}
                    </div>
                    {a.decision === "pending" ? (
                      <div className="flex gap-2">
                        {a.approver_id === user?.id && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => decideApproval(a.id, "approved")}>
                              <CheckCircle2 className="h-4 w-4 mr-1 text-success" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decideApproval(a.id, "rejected")}>
                              <XCircle className="h-4 w-4 mr-1 text-destructive" /> Reject
                            </Button>
                          </>
                        )}
                        {a.approver_id !== user?.id && <Badge variant="outline">Pending</Badge>}
                      </div>
                    ) : (
                      <Badge className={cn(
                        a.decision === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      )}>{a.decision}</Badge>
                    )}
                  </Card>
                ))}

                <Card className="p-4">
                  <h4 className="font-medium mb-3">Add approval</h4>
                  <div className="flex gap-2">
                    <Select value={newApprovalKind} onValueChange={setNewApprovalKind}>
                      <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="cab">CAB</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="operational">Operational</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={newApproverId} onValueChange={setNewApproverId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select approver" /></SelectTrigger>
                      <SelectContent>
                        {orgUsers.map((u: any) => (
                          <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={addApproval}><Plus className="h-4 w-4" /></Button>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="activity" className="space-y-2">
                {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
                {activity.map((a: any) => (
                  <div key={a.id} className="flex gap-3 text-sm border-l-2 border-muted pl-3">
                    <div className="flex-1">
                      <p className="font-medium">{a.event_type.replace(/_/g, " ")}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "PPp")}</span>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <Card className="p-4 space-y-4">
              <h3 className="font-semibold">Properties</h3>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={change.status} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={change.change_type} onValueChange={(v) => updateField("change_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["standard","normal","emergency","operational"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Urgency</Label>
                <Select value={change.urgency} onValueChange={(v) => updateField("urgency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low","medium","high","critical"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Impact</Label>
                <Select value={change.impact} onValueChange={(v) => updateField("impact", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low","medium","high","critical"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Owner</Label>
                <Select value={change.owner_id ?? "none"} onValueChange={(v) => updateField("owner_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {orgUsers.map((u: any) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            <Card className="p-4 space-y-2">
              <h3 className="font-semibold">Schedule</h3>
              <p className="text-sm"><span className="text-muted-foreground">Planned start:</span> {change.planned_start_at ? format(new Date(change.planned_start_at), "PPp") : "—"}</p>
              <p className="text-sm"><span className="text-muted-foreground">Planned end:</span> {change.planned_end_at ? format(new Date(change.planned_end_at), "PPp") : "—"}</p>
              <p className="text-sm"><span className="text-muted-foreground">Downtime:</span> {change.downtime_required ? "Required" : "None"}</p>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function DetailField({ label, value, onSave, multiline }: { label: string; value: string | null; onSave: (v: string) => void; multiline?: boolean }) {
  const [v, setV] = useState(value ?? "");
  return (
    <Card className="p-4 space-y-2">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value ?? "") && onSave(v || null as any)} />
      ) : (
        <input className="w-full" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value ?? "") && onSave(v)} />
      )}
    </Card>
  );
}

import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, XCircle, Plus, MessageSquare, ArrowRight, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { format, formatDistanceToNow } from "date-fns";
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

// Fields that should prompt the user for an explanatory comment when changed.
const COMMENT_FIELDS = new Set(["status", "change_type", "urgency", "impact", "owner_id"]);

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  change_type: "Type",
  urgency: "Urgency",
  impact: "Impact",
  owner_id: "Owner",
  implementer_id: "Implementer",
  reason: "Reason",
  implementation_plan: "Implementation plan",
  rollback_plan: "Rollback plan",
  test_plan: "Test plan",
  communication_plan: "Communication plan",
  planned_start_at: "Planned start",
  planned_end_at: "Planned end",
};

const PROGRESS_KINDS = [
  { key: "progress_note", label: "Progress update", icon: Wrench },
  { key: "test_result", label: "Test result", icon: CheckCircle2 },
  { key: "implementation_note", label: "Implementation note", icon: Wrench },
  { key: "comment", label: "General comment", icon: MessageSquare },
];

export default function ChangeManagementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [newApprovalKind, setNewApprovalKind] = useState<string>("technical");
  const [newApproverId, setNewApproverId] = useState<string>("");

  // Comment-on-change dialog state
  const [pendingChange, setPendingChange] = useState<{ field: string; from: any; to: any } | null>(null);
  const [pendingComment, setPendingComment] = useState("");

  // Progress / test result composer
  const [progressKind, setProgressKind] = useState<string>("progress_note");
  const [progressText, setProgressText] = useState("");

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

  const usersById = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>();
    for (const u of orgUsers as any[]) {
      map.set(u.user_id, { name: u.full_name || u.email || "Unknown", email: u.email || "" });
    }
    return map;
  }, [orgUsers]);

  const userLabel = (uid: string | null | undefined) => {
    if (!uid) return "Unassigned";
    return usersById.get(uid)?.name ?? `User ${uid.slice(0, 6)}`;
  };

  const formatVal = (field: string, v: any): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (field === "owner_id" || field === "implementer_id") return userLabel(v);
    if (field === "planned_start_at" || field === "planned_end_at") {
      try { return format(new Date(v), "PPp"); } catch { return String(v); }
    }
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v).replace(/_/g, " ");
  };

  // Whether the current user can post implementer-style comments.
  const canPostProgress =
    !!user && !!change && (
      change.implementer_id === user.id ||
      change.owner_id === user.id ||
      change.created_by === user.id ||
      change.requested_by === user.id
    );

  const writeActivity = async (payload: {
    event_type: string;
    from_value?: any;
    to_value?: any;
    notes?: string | null;
  }) => {
    if (!change) return;
    await supabase.from("change_management_activity").insert({
      change_id: change.id,
      organization_id: change.organization_id,
      actor_user_id: user?.id ?? null,
      event_type: payload.event_type,
      from_value: payload.from_value ?? null,
      to_value: payload.to_value ?? null,
      notes: payload.notes ?? null,
    });
  };

  const persistFieldChange = async (field: string, value: any, comment?: string | null) => {
    if (!change) return;
    const prev = (change as any)[field];
    if (prev === value) return;
    const { error } = await supabase
      .from("change_management_requests")
      .update({ [field]: value })
      .eq("id", change.id);
    if (error) { toast.error(error.message); return; }
    await writeActivity({
      event_type: `${field}_changed`,
      from_value: { [field]: prev },
      to_value: { [field]: value },
      notes: comment?.trim() ? comment.trim() : null,
    });
    toast.success(`${FIELD_LABELS[field] ?? field} updated`);
    qc.invalidateQueries({ queryKey: ["cm-request", id] });
    qc.invalidateQueries({ queryKey: ["cm-activity", id] });
  };

  const updateField = (field: string, value: any) => {
    if (!change) return;
    const prev = (change as any)[field];
    if (prev === value) return;
    if (COMMENT_FIELDS.has(field)) {
      setPendingChange({ field, from: prev, to: value });
      setPendingComment("");
      return;
    }
    void persistFieldChange(field, value);
  };

  const confirmPendingChange = async (skipComment: boolean) => {
    if (!pendingChange) return;
    const { field, to } = pendingChange;
    const comment = skipComment ? null : pendingComment;
    setPendingChange(null);
    setPendingComment("");
    await persistFieldChange(field, to, comment);
  };

  const submitProgress = async () => {
    if (!progressText.trim()) { toast.error("Add some detail first"); return; }
    await writeActivity({
      event_type: progressKind,
      notes: progressText.trim(),
    });
    setProgressText("");
    toast.success("Comment posted");
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
    await writeActivity({
      event_type: "approval_added",
      to_value: { approval_kind: newApprovalKind, approver_id: newApproverId },
      notes: `Approval request sent to ${userLabel(newApproverId)} (${newApprovalKind})`,
    });
    toast.success("Approval added");
    setNewApproverId("");
    qc.invalidateQueries({ queryKey: ["cm-approvals", id] });
    qc.invalidateQueries({ queryKey: ["cm-activity", id] });
  };

  const decideApproval = async (approval: any, decision: "approved" | "rejected") => {
    const { error } = await supabase.from("change_management_approvals").update({
      decision,
      decided_at: new Date().toISOString(),
    }).eq("id", approval.id);
    if (error) { toast.error(error.message); return; }
    await writeActivity({
      event_type: `approval_${decision}`,
      to_value: { approval_kind: approval.approval_kind, decision },
      notes: `${userLabel(user?.id)} ${decision} the ${approval.approval_kind} approval`,
    });
    toast.success(`Marked ${decision}`);
    qc.invalidateQueries({ queryKey: ["cm-approvals", id] });
    qc.invalidateQueries({ queryKey: ["cm-activity", id] });
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
                <DetailField label="Reason" value={change.reason} onSave={(v) => persistFieldChange("reason", v)} multiline />
                <DetailField label="Implementation plan" value={change.implementation_plan} onSave={(v) => persistFieldChange("implementation_plan", v)} multiline />
                <DetailField label="Rollback plan" value={change.rollback_plan} onSave={(v) => persistFieldChange("rollback_plan", v)} multiline />
                <DetailField label="Test plan" value={change.test_plan} onSave={(v) => persistFieldChange("test_plan", v)} multiline />
                <DetailField label="Communication plan" value={change.communication_plan} onSave={(v) => persistFieldChange("communication_plan", v)} multiline />
              </TabsContent>

              <TabsContent value="approvals" className="space-y-3">
                {approvals.map((a: any) => (
                  <Card key={a.id} className="p-4 flex items-center justify-between">
                    <div>
                      <Badge variant="outline">{a.approval_kind}</Badge>
                      <p className="text-sm mt-1">
                        Approver: <span className="font-medium">{userLabel(a.approver_id)}</span>
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
                            <Button size="sm" variant="outline" onClick={() => decideApproval(a, "approved")}>
                              <CheckCircle2 className="h-4 w-4 mr-1 text-success" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decideApproval(a, "rejected")}>
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

              <TabsContent value="activity" className="space-y-4">
                {/* Implementer / owner comment composer */}
                {canPostProgress && (
                  <Card className="p-4 space-y-3 border-primary/30">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <h4 className="font-medium">Post an update</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Implementers, owners and requesters can record progress, test results or general notes against this change.
                    </p>
                    <div className="flex gap-2">
                      <Select value={progressKind} onValueChange={setProgressKind}>
                        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROGRESS_KINDS.map(k => (
                            <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      rows={3}
                      placeholder="Describe progress, test outcomes, blockers, or context for the team…"
                      value={progressText}
                      onChange={(e) => setProgressText(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={submitProgress} disabled={!progressText.trim()}>
                        Post update
                      </Button>
                    </div>
                  </Card>
                )}

                {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}

                <div className="space-y-3">
                  {activity.map((a: any) => {
                    const actorName = userLabel(a.actor_user_id);
                    const initials = actorName.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
                    const isFieldChange = a.event_type?.endsWith("_changed");
                    const fieldKey = isFieldChange ? a.event_type.replace(/_changed$/, "") : null;
                    const fromV = fieldKey ? a.from_value?.[fieldKey] : null;
                    const toV = fieldKey ? a.to_value?.[fieldKey] : null;
                    return (
                      <Card key={a.id} className="p-3">
                        <div className="flex gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2 flex-wrap">
                              <p className="text-sm">
                                <span className="font-medium">{actorName}</span>{" "}
                                <span className="text-muted-foreground">
                                  {renderEventVerb(a.event_type)}
                                </span>
                                {fieldKey && (
                                  <span className="font-medium"> {FIELD_LABELS[fieldKey] ?? fieldKey.replace(/_/g, " ")}</span>
                                )}
                              </p>
                              <span
                                className="text-xs text-muted-foreground"
                                title={format(new Date(a.created_at), "PPpp")}
                              >
                                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                              </span>
                            </div>

                            {isFieldChange && fieldKey && (
                              <div className="mt-1 flex items-center gap-2 text-xs flex-wrap">
                                <Badge variant="outline" className="font-mono">{formatVal(fieldKey, fromV)}</Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge className={cn(
                                  fieldKey === "status" && STATUS_STYLES[toV],
                                  "font-mono",
                                )}>{formatVal(fieldKey, toV)}</Badge>
                              </div>
                            )}

                            {a.notes && (
                              <p className="mt-2 text-sm whitespace-pre-wrap bg-muted/40 rounded-md p-2">
                                {a.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
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
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Implementer</Label>
                <Select
                  value={change.implementer_id ?? "none"}
                  onValueChange={(v) => persistFieldChange("implementer_id", v === "none" ? null : v)}
                >
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

      {/* Comment-on-change dialog */}
      <Dialog open={!!pendingChange} onOpenChange={(o) => { if (!o) { setPendingChange(null); setPendingComment(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change {pendingChange ? (FIELD_LABELS[pendingChange.field] ?? pendingChange.field) : ""}?
            </DialogTitle>
            <DialogDescription>
              Add a short note explaining the reason for this change. It will be recorded on the activity timeline.
            </DialogDescription>
          </DialogHeader>
          {pendingChange && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{formatVal(pendingChange.field, pendingChange.from)}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className={cn(
                  pendingChange.field === "status" && STATUS_STYLES[pendingChange.to],
                )}>
                  {formatVal(pendingChange.field, pendingChange.to)}
                </Badge>
              </div>
              <Textarea
                rows={4}
                placeholder="Why is this changing? (optional but recommended)"
                value={pendingComment}
                onChange={(e) => setPendingComment(e.target.value)}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setPendingChange(null); setPendingComment(""); }}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => confirmPendingChange(true)}>
              Save without comment
            </Button>
            <Button onClick={() => confirmPendingChange(false)} disabled={!pendingComment.trim()}>
              Save with comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function renderEventVerb(eventType: string): string {
  if (!eventType) return "updated";
  if (eventType === "approval_added") return "requested approval —";
  if (eventType === "approval_approved") return "approved";
  if (eventType === "approval_rejected") return "rejected";
  if (eventType === "progress_note") return "posted a progress update";
  if (eventType === "test_result") return "logged a test result";
  if (eventType === "implementation_note") return "added an implementation note";
  if (eventType === "comment") return "commented";
  if (eventType.endsWith("_changed")) return "updated";
  return eventType.replace(/_/g, " ");
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

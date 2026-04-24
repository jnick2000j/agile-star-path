import { useMemo, useRef, useState } from "react";
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
import { ArrowLeft, CheckCircle2, XCircle, Plus, MessageSquare, ArrowRight, Wrench, Paperclip, X, Download, FileText, Image as ImageIcon } from "lucide-react";
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

// Default fields that prompt the user for an explanatory comment when changed.
// (Always-on prompt — admin "require_comment_*" toggles in addition to this make it MANDATORY.)
const COMMENT_FIELDS = new Set(["status", "change_type", "urgency", "impact", "owner_id"]);

// Map field key → admin "require comment" setting column
const REQUIRE_FIELD_MAP: Record<string, string> = {
  status: "require_comment_on_status",
  change_type: "require_comment_on_type",
  urgency: "require_comment_on_urgency",
  impact: "require_comment_on_impact",
  owner_id: "require_comment_on_owner",
};

// Map activity event_type → admin "require comment on activity" setting column
const REQUIRE_ACTIVITY_MAP: Record<string, string> = {
  progress_note: "require_comment_on_progress",
  test_result: "require_comment_on_test",
  implementation_note: "require_comment_on_implementation",
  comment: "require_comment_on_comment",
};

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const activityIds = useMemo(() => (activity as any[]).map((a) => a.id), [activity]);

  const { data: activityAttachments = [] } = useQuery({
    queryKey: ["cm-activity-attachments", id, activityIds.length],
    queryFn: async () => {
      if (!activityIds.length) return [];
      const { data } = await supabase
        .from("documents")
        .select("id, name, file_path, file_size, mime_type, entity_id, created_at")
        .eq("entity_type", "change_activity")
        .in("entity_id", activityIds);
      return data ?? [];
    },
    enabled: !!id && activityIds.length > 0,
  });

  const attachmentsByActivity = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of activityAttachments as any[]) {
      const arr = map.get(a.entity_id) ?? [];
      arr.push(a);
      map.set(a.entity_id, arr);
    }
    return map;
  }, [activityAttachments]);

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

  const { data: notifSettings } = useQuery({
    queryKey: ["cm-notif-settings", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      const { data } = await supabase
        .from("change_notification_settings")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const requiresComment = (field: string, toValue?: any): boolean => {
    if (!notifSettings) return false;
    if (field === "status" && typeof toValue === "string") {
      const perStatusKey: Record<string, string> = {
        scheduled: "require_comment_on_status_scheduled",
        in_progress: "require_comment_on_status_in_progress",
        implemented: "require_comment_on_status_implemented",
        closed: "require_comment_on_status_closed",
      };
      const perKey = perStatusKey[toValue];
      if (perKey && (notifSettings as any)[perKey]) return true;
    }
    const key = REQUIRE_FIELD_MAP[field];
    return key ? !!(notifSettings as any)[key] : false;
  };

  const requiresActivityComment = (eventType: string): boolean => {
    // Default to true if settings not yet loaded — safer to require detail.
    const key = REQUIRE_ACTIVITY_MAP[eventType];
    if (!key) return true;
    if (!notifSettings) return true;
    return !!(notifSettings as any)[key];
  };

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

  const fireActivityNotification = async (event_type: string, from_value: any, to_value: any, notes: string | null) => {
    if (!change) return;
    try {
      await supabase.functions.invoke("notify-cm-activity", {
        body: {
          change_id: change.id,
          event_type,
          from_value,
          to_value,
          notes,
          action_url: `${window.location.origin}/change-management/${change.id}`,
        },
      });
    } catch (e) {
      // best-effort — never block on notification
      console.warn("notify-cm-activity failed", e);
    }
  };

  const writeActivity = async (payload: {
    event_type: string;
    from_value?: any;
    to_value?: any;
    notes?: string | null;
  }): Promise<string | null> => {
    if (!change) return null;
    const { data, error } = await supabase
      .from("change_management_activity")
      .insert({
        change_id: change.id,
        organization_id: change.organization_id,
        actor_user_id: user?.id ?? null,
        event_type: payload.event_type,
        from_value: payload.from_value ?? null,
        to_value: payload.to_value ?? null,
        notes: payload.notes ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("activity insert failed", error);
      return null;
    }
    // Fire-and-forget email + in-app notification dispatch
    void fireActivityNotification(
      payload.event_type,
      payload.from_value ?? null,
      payload.to_value ?? null,
      payload.notes ?? null,
    );
    return data?.id ?? null;
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
    // Enforce admin "require comment" toggles
    if (skipComment && requiresComment(field, to)) {
      toast.error("A comment is required for this change");
      return;
    }
    const comment = skipComment ? null : pendingComment;
    setPendingChange(null);
    setPendingComment("");
    await persistFieldChange(field, to, comment);
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const MAX = 25 * 1024 * 1024; // 25MB
    const accepted: File[] = [];
    for (const f of files) {
      if (f.size > MAX) {
        toast.error(`${f.name} is too large (25MB max)`);
        continue;
      }
      accepted.push(f);
    }
    setPendingFiles((prev) => [...prev, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadAttachmentsForActivity = async (activityId: string) => {
    if (!change || !user || pendingFiles.length === 0) return;
    for (const file of pendingFiles) {
      const fileExt = file.name.split(".").pop();
      const filePath = `change_activity/${activityId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(filePath, file);
      if (upErr) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }
      const { error: dbErr } = await supabase.from("documents").insert({
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        entity_type: "change_activity",
        entity_id: activityId,
        uploaded_by: user.id,
      });
      if (dbErr) {
        toast.error(`Failed to record ${file.name}`);
      }
    }
  };

  const submitProgress = async () => {
    const required = requiresActivityComment(progressKind);
    const hasFiles = pendingFiles.length > 0;
    if (required && !progressText.trim() && !hasFiles) {
      toast.error("A comment is required for this update type");
      return;
    }
    if (!progressText.trim() && !hasFiles) {
      toast.error("Add a comment or attach a file before posting");
      return;
    }
    setUploadingAttachments(true);
    try {
      const activityId = await writeActivity({
        event_type: progressKind,
        notes: progressText.trim() || null,
      });
      if (activityId && hasFiles) {
        await uploadAttachmentsForActivity(activityId);
      }
      setProgressText("");
      setPendingFiles([]);
      toast.success(hasFiles ? "Update posted with attachments" : "Update posted");
      qc.invalidateQueries({ queryKey: ["cm-activity", id] });
      qc.invalidateQueries({ queryKey: ["cm-activity-attachments", id] });
    } finally {
      setUploadingAttachments(false);
    }
  };

  const downloadAttachment = async (doc: { file_path: string; name: string }) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Failed to generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
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
                {canPostProgress && (() => {
                  const required = requiresActivityComment(progressKind);
                  const hasText = !!progressText.trim();
                  const hasFiles = pendingFiles.length > 0;
                  // When admin requires comment, accept either text OR attachments as evidence.
                  const blocked = required && !hasText && !hasFiles;
                  const emptyPost = !hasText && !hasFiles;
                  const kindLabel = PROGRESS_KINDS.find(k => k.key === progressKind)?.label ?? progressKind;
                  return (
                    <Card className={cn(
                      "p-4 space-y-3 border",
                      blocked ? "border-destructive/50" : "border-primary/30",
                    )}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-primary" />
                          <h4 className="font-medium">Post an update</h4>
                        </div>
                        {required ? (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                            Comment or attachment required for {kindLabel}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Comment optional</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Implementers, owners and requesters can record progress, test results or general notes against this change. Attach screenshots, logs or test reports as supporting evidence.
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
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          Comment
                          {required && <span className="text-destructive font-semibold">*</span>}
                          {required && (
                            <span className="text-muted-foreground font-normal">
                              (required for {kindLabel.toLowerCase()} — text or an attachment)
                            </span>
                          )}
                        </Label>
                        <Textarea
                          rows={3}
                          aria-required={required}
                          aria-invalid={blocked}
                          className={cn(blocked && "border-destructive focus-visible:ring-destructive")}
                          placeholder={
                            required
                              ? `Describe ${kindLabel.toLowerCase()} or attach evidence below`
                              : "Describe progress, test outcomes, blockers, or context for the team… (optional)"
                          }
                          value={progressText}
                          onChange={(e) => setProgressText(e.target.value)}
                        />
                        {blocked && (
                          <p className="text-xs text-destructive">
                            Add a comment or attach a file before posting — your administrator requires evidence for this update type.
                          </p>
                        )}
                      </div>

                      {/* Attachments picker */}
                      <div className="space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleAddFiles}
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.log,.json,.zip"
                        />
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingAttachments}
                            className="gap-2"
                          >
                            <Paperclip className="h-4 w-4" />
                            Attach files or screenshots
                          </Button>
                          {pendingFiles.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {pendingFiles.length} file{pendingFiles.length === 1 ? "" : "s"} ready
                            </span>
                          )}
                        </div>
                        {pendingFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {pendingFiles.map((f, idx) => {
                              const isImg = f.type.startsWith("image/");
                              const Icon = isImg ? ImageIcon : FileText;
                              return (
                                <div
                                  key={`${f.name}-${idx}`}
                                  className="flex items-center gap-2 bg-muted/60 rounded-md pl-2 pr-1 py-1 text-xs"
                                >
                                  <Icon className="h-3.5 w-3.5 text-primary" />
                                  <span className="max-w-[180px] truncate">{f.name}</span>
                                  <span className="text-muted-foreground">
                                    {(f.size / 1024).toFixed(0)} KB
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => removePendingFile(idx)}
                                    disabled={uploadingAttachments}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={submitProgress}
                          disabled={blocked || emptyPost || uploadingAttachments}
                          title={
                            blocked
                              ? "Add a comment or attachment to post this update"
                              : emptyPost
                                ? "Add a comment or attachment"
                                : undefined
                          }
                        >
                          {uploadingAttachments ? "Posting…" : "Post update"}
                        </Button>
                      </div>
                    </Card>
                  );
                })()}


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

                            {(() => {
                              const atts = attachmentsByActivity.get(a.id) ?? [];
                              if (atts.length === 0) return null;
                              return (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {atts.map((doc: any) => {
                                    const isImg = (doc.mime_type ?? "").startsWith("image/");
                                    const Icon = isImg ? ImageIcon : FileText;
                                    const sizeLabel = doc.file_size
                                      ? doc.file_size < 1024 * 1024
                                        ? `${(doc.file_size / 1024).toFixed(0)} KB`
                                        : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`
                                      : "";
                                    return (
                                      <button
                                        key={doc.id}
                                        type="button"
                                        onClick={() => downloadAttachment(doc)}
                                        className="flex items-center gap-2 bg-muted/60 hover:bg-muted rounded-md px-2 py-1 text-xs transition-colors"
                                        title={`Download ${doc.name}`}
                                      >
                                        <Icon className="h-3.5 w-3.5 text-primary" />
                                        <span className="max-w-[180px] truncate">{doc.name}</span>
                                        {sizeLabel && (
                                          <span className="text-muted-foreground">{sizeLabel}</span>
                                        )}
                                        <Download className="h-3 w-3 text-muted-foreground" />
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
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
              {pendingChange && requiresComment(pendingChange.field, pendingChange.to)
                ? "An update note is required for this change. It will be recorded on the activity timeline and emailed to stakeholders."
                : "Add a short note explaining the reason for this change. It will be recorded on the activity timeline."}
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
                placeholder={
                  requiresComment(pendingChange.field)
                    ? "A comment is required — explain why this is changing"
                    : "Why is this changing? (optional but recommended)"
                }
                value={pendingComment}
                onChange={(e) => setPendingComment(e.target.value)}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setPendingChange(null); setPendingComment(""); }}>
              Cancel
            </Button>
            {pendingChange && !requiresComment(pendingChange.field) && (
              <Button variant="outline" onClick={() => confirmPendingChange(true)}>
                Save without comment
              </Button>
            )}
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

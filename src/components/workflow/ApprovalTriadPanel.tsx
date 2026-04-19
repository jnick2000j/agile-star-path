import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MinusCircle,
  Plus,
  Trash2,
  ShieldCheck,
  UserCheck,
  Crown,
  Bell,
  Pencil,
  X,
  MessageSquare,
  Edit3,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export type WorkflowEntityType =
  | "stage_gate"
  | "change_request"
  | "milestone"
  | "exception"
  | "quality_review";

interface Props {
  entityType: WorkflowEntityType;
  entityId: string;
  entityTitle?: string;
  organizationId: string | null;
  ownerId?: string | null;
  ownerLabel?: string;
  /** Hide the inline Owner row (e.g. when the parent already shows it) */
  hideOwner?: boolean;
  /** Called when user changes the owner. Parent must persist to its own table. */
  onOwnerChange?: (newOwnerId: string | null) => Promise<void> | void;
}

interface ApprovalRow {
  id: string;
  reviewer_id: string;
  reviewer_role: string | null;
  approval_role: "approver" | "verifier";
  decision:
    | "pending"
    | "approve"
    | "reject"
    | "abstain"
    | "conditional"
    | "modification_required"
    | "verified"
    | "rejected_verification";
  comments: string | null;
  conditions: string | null;
  signed_at: string | null;
  is_required: boolean;
}

interface CommentRow {
  id: string;
  approval_id: string;
  author_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

interface NotifierRow {
  id: string;
  user_id: string;
  notify_role: string | null;
}

interface OrgUser {
  user_id: string;
  full_name: string | null;
  email: string;
}

const decisionMeta: Record<
  ApprovalRow["decision"],
  { label: string; icon: any; cls: string }
> = {
  pending: { label: "Pending", icon: Clock, cls: "bg-muted text-muted-foreground" },
  approve: { label: "Approved", icon: CheckCircle2, cls: "bg-success/20 text-success" },
  verified: { label: "Verified", icon: ShieldCheck, cls: "bg-success/20 text-success" },
  reject: { label: "Rejected", icon: XCircle, cls: "bg-destructive/20 text-destructive" },
  rejected_verification: {
    label: "Verification failed",
    icon: XCircle,
    cls: "bg-destructive/20 text-destructive",
  },
  abstain: { label: "Abstained", icon: MinusCircle, cls: "bg-muted text-muted-foreground" },
  conditional: {
    label: "Conditional",
    icon: AlertTriangle,
    cls: "bg-warning/20 text-warning",
  },
  modification_required: {
    label: "Modification required",
    icon: Edit3,
    cls: "bg-warning/20 text-warning",
  },
};

const approverDecisionOptions = [
  { value: "approve", label: "Approve" },
  { value: "conditional", label: "Conditional" },
  { value: "modification_required", label: "Modification required" },
  { value: "reject", label: "Reject" },
  { value: "abstain", label: "Abstain" },
];

const verifierDecisionOptions = [
  { value: "verified", label: "Verified" },
  { value: "rejected_verification", label: "Verification failed" },
  { value: "abstain", label: "Abstain" },
];

function getInitials(name: string | null | undefined, email?: string | null) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

export function ApprovalTriadPanel({
  entityType,
  entityId,
  entityTitle,
  organizationId,
  ownerId,
  ownerLabel = "Owner",
  hideOwner = false,
  onOwnerChange,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [addRole, setAddRole] = useState<"approver" | "verifier" | null>(null);
  const [addingNotifier, setAddingNotifier] = useState(false);
  const [editingOwner, setEditingOwner] = useState(false);
  const [newReviewer, setNewReviewer] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRequired, setNewRequired] = useState(true);
  const [newNotifier, setNewNotifier] = useState("");
  const [newNotifierRole, setNewNotifierRole] = useState("");
  const [pendingOwner, setPendingOwner] = useState<string>("");
  const [decisionForms, setDecisionForms] = useState<
    Record<string, { decision: string; comments: string; conditions: string }>
  >({});

  const queryKey = ["workflow-approvals", entityType, entityId];
  const notifiersKey = ["workflow-notifiers", entityType, entityId];

  const { data: approvals = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_approvals")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as ApprovalRow[];
    },
    enabled: !!entityId,
  });

  const { data: notifiers = [] } = useQuery({
    queryKey: notifiersKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_notifiers")
        .select("id, user_id, notify_role")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as NotifierRow[];
    },
    enabled: !!entityId,
  });

  const { data: orgUsers = [] } = useQuery({
    queryKey: ["org-users", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("user_organization_access")
        .select("user_id, profiles!inner(full_name, email)")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        user_id: row.user_id,
        full_name: row.profiles?.full_name,
        email: row.profiles?.email,
      })) as OrgUser[];
    },
    enabled: !!organizationId,
  });

  const owner = ownerId ? orgUsers.find((u) => u.user_id === ownerId) : null;

  // Fire-and-forget notify
  const notifyAssignment = async (
    recipient_user_id: string,
    role: "owner" | "approver" | "verifier" | "notifier",
  ) => {
    try {
      await supabase.functions.invoke("notify-workflow-assignment", {
        body: {
          entity_type: entityType,
          entity_id: entityId,
          entity_title: entityTitle,
          assignment_role: role,
          recipient_user_id,
          organization_id: organizationId,
          action_url: window.location.href,
        },
      });
    } catch (e) {
      console.error("notify failed", e);
    }
  };

  const addReviewer = useMutation({
    mutationFn: async () => {
      if (!newReviewer || !addRole) throw new Error("Pick a reviewer");
      const { error } = await supabase.from("workflow_approvals").insert({
        entity_type: entityType,
        entity_id: entityId,
        reviewer_id: newReviewer,
        reviewer_role: newRoleLabel || null,
        approval_role: addRole,
        is_required: newRequired,
        organization_id: organizationId,
        created_by: user?.id,
      });
      if (error) throw error;
      await notifyAssignment(newReviewer, addRole);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setAddRole(null);
      setNewReviewer("");
      setNewRoleLabel("");
      setNewRequired(true);
      toast.success("Reviewer added and notified");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeReviewer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workflow_approvals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const submitDecision = useMutation({
    mutationFn: async ({
      id,
      decision,
      comments,
      conditions,
    }: {
      id: string;
      decision: string;
      comments: string;
      conditions: string;
    }) => {
      const { error } = await supabase
        .from("workflow_approvals")
        .update({
          decision,
          comments: comments || null,
          conditions: conditions || null,
          signed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Decision recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNotifier = useMutation({
    mutationFn: async () => {
      if (!newNotifier) throw new Error("Pick a user");
      const { error } = await supabase.from("workflow_notifiers").insert({
        entity_type: entityType,
        entity_id: entityId,
        user_id: newNotifier,
        notify_role: newNotifierRole || null,
        organization_id: organizationId,
        created_by: user?.id,
      });
      if (error) throw error;
      await notifyAssignment(newNotifier, "notifier");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifiersKey });
      setAddingNotifier(false);
      setNewNotifier("");
      setNewNotifierRole("");
      toast.success("Notifier added and notified");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNotifier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workflow_notifiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notifiersKey }),
  });

  const saveOwner = useMutation({
    mutationFn: async (newOwnerId: string | null) => {
      if (!onOwnerChange) throw new Error("Owner editing is not supported here");
      await onOwnerChange(newOwnerId);
      if (newOwnerId) await notifyAssignment(newOwnerId, "owner");
    },
    onSuccess: () => {
      setEditingOwner(false);
      setPendingOwner("");
      toast.success("Owner updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const userName = (uid: string) => {
    const u = orgUsers.find((o) => o.user_id === uid);
    return u?.full_name || u?.email || uid.slice(0, 8);
  };

  const approvers = approvals.filter((a) => a.approval_role === "approver");
  const verifiers = approvals.filter((a) => a.approval_role === "verifier");

  const requiredApprovers = approvers.filter((a) => a.is_required);
  const signedApprovers = requiredApprovers.filter(
    (a) => a.decision === "approve" || a.decision === "conditional",
  );
  const requiredVerifiers = verifiers.filter((a) => a.is_required);
  const signedVerifiers = requiredVerifiers.filter((a) => a.decision === "verified");
  const anyRejected = approvals.some(
    (a) => a.decision === "reject" || a.decision === "rejected_verification",
  );
  const allApproved =
    requiredApprovers.length > 0 &&
    signedApprovers.length === requiredApprovers.length &&
    !anyRejected;
  const allVerified =
    requiredVerifiers.length === 0 ||
    (signedVerifiers.length === requiredVerifiers.length && !anyRejected);
  const fullySignedOff = allApproved && allVerified;

  const renderRow = (a: ApprovalRow) => {
    const Icon = decisionMeta[a.decision].icon;
    const isMe = a.reviewer_id === user?.id;
    const options =
      a.approval_role === "verifier" ? verifierDecisionOptions : approverDecisionOptions;
    const defaultDecision =
      a.decision === "pending"
        ? a.approval_role === "verifier"
          ? "verified"
          : "approve"
        : a.decision;
    const form = decisionForms[a.id] ?? {
      decision: defaultDecision,
      comments: a.comments ?? "",
      conditions: a.conditions ?? "",
    };
    return (
      <div key={a.id} className="rounded-md border border-border bg-card p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {getInitials(
                  orgUsers.find((u) => u.user_id === a.reviewer_id)?.full_name,
                  orgUsers.find((u) => u.user_id === a.reviewer_id)?.email,
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{userName(a.reviewer_id)}</span>
                {a.reviewer_role && (
                  <span className="text-xs text-muted-foreground">· {a.reviewer_role}</span>
                )}
                {a.is_required && (
                  <Badge variant="outline" className="text-xs">
                    Required
                  </Badge>
                )}
                <Badge className={decisionMeta[a.decision].cls + " text-xs"}>
                  <Icon className="h-3 w-3 mr-1" />
                  {decisionMeta[a.decision].label}
                </Badge>
              </div>
              {a.signed_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Signed {format(new Date(a.signed_at), "PPp")}
                </p>
              )}
              {a.comments && <p className="text-xs mt-1">{a.comments}</p>}
              {a.conditions && (
                <p className="text-xs mt-1 text-warning">
                  <strong>Conditions:</strong> {a.conditions}
                </p>
              )}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => removeReviewer.mutate(a.id)}
            aria-label="Remove reviewer"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        {isMe && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">Your decision</p>
            <div className="flex gap-2">
              <Select
                value={form.decision}
                onValueChange={(v) =>
                  setDecisionForms((p) => ({ ...p, [a.id]: { ...form, decision: v } }))
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() =>
                  submitDecision.mutate({
                    id: a.id,
                    decision: form.decision,
                    comments: form.comments,
                    conditions: form.conditions,
                  })
                }
              >
                {a.signed_at ? "Update" : "Sign off"}
              </Button>
            </div>
            <Textarea
              rows={2}
              placeholder="Comments"
              value={form.comments}
              onChange={(e) =>
                setDecisionForms((p) => ({
                  ...p,
                  [a.id]: { ...form, comments: e.target.value },
                }))
              }
            />
            {form.decision === "conditional" && (
              <Textarea
                rows={2}
                placeholder="Conditions that must be met"
                value={form.conditions}
                onChange={(e) =>
                  setDecisionForms((p) => ({
                    ...p,
                    [a.id]: { ...form, conditions: e.target.value },
                  }))
                }
              />
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAddForm = (role: "approver" | "verifier") => (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3">
      <p className="text-xs font-medium capitalize">Add {role}</p>
      <div>
        <Label className="text-xs">Reviewer</Label>
        <Select value={newReviewer} onValueChange={setNewReviewer}>
          <SelectTrigger>
            <SelectValue placeholder="Select user" />
          </SelectTrigger>
          <SelectContent>
            {orgUsers.map((u) => (
              <SelectItem key={u.user_id} value={u.user_id}>
                {u.full_name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Role label (optional)</Label>
        <Input
          value={newRoleLabel}
          onChange={(e) => setNewRoleLabel(e.target.value)}
          placeholder={
            role === "approver" ? "e.g. Sponsor, Senior User" : "e.g. QA Lead, Auditor"
          }
        />
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={newRequired}
          onChange={(e) => setNewRequired(e.target.checked)}
        />
        Required for sign-off
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => addReviewer.mutate()}>
          Add & notify
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAddRole(null)}>
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-sm font-semibold">Sign-off & notifications</h4>
          <p className="text-xs text-muted-foreground">
            Approvers: {signedApprovers.length}/{requiredApprovers.length || 0} ·
            Verifiers: {signedVerifiers.length}/{requiredVerifiers.length || 0} ·
            Notifiers: {notifiers.length}
          </p>
        </div>
        {fullySignedOff && (
          <Badge className="bg-success/20 text-success">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Fully signed off
          </Badge>
        )}
        {anyRejected && (
          <Badge className="bg-destructive/20 text-destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )}
      </div>

      {/* Owner */}
      {!hideOwner && (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {ownerLabel}
              </h5>
            </div>
            {onOwnerChange && !editingOwner && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingOwner(true);
                  setPendingOwner(ownerId ?? "");
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {owner ? "Change" : "Add owner"}
              </Button>
            )}
          </div>
          {editingOwner ? (
            <div className="space-y-2">
              <Select value={pendingOwner} onValueChange={setPendingOwner}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {orgUsers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveOwner.mutate(pendingOwner || null)}>
                  Save & notify
                </Button>
                {ownerId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveOwner.mutate(null)}
                  >
                    Remove owner
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingOwner(false);
                    setPendingOwner("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : owner ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {getInitials(owner.full_name, owner.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{owner.full_name || owner.email}</p>
                <p className="text-xs text-muted-foreground">Accountable</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No owner assigned.</p>
          )}
        </div>
      )}

      {/* Approvers */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Approvers
          </h5>
        </div>
        {approvers.map(renderRow)}
        {approvers.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-1">No approvers assigned.</p>
        )}
        {addRole === "approver" ? (
          renderAddForm("approver")
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddRole("approver");
              setNewReviewer("");
              setNewRoleLabel("");
              setNewRequired(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add approver
          </Button>
        )}
      </div>

      {/* Verifiers */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Verifiers
          </h5>
        </div>
        {verifiers.map(renderRow)}
        {verifiers.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-1">
            No verifiers assigned. Verifiers independently confirm evidence is met.
          </p>
        )}
        {addRole === "verifier" ? (
          renderAddForm("verifier")
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddRole("verifier");
              setNewReviewer("");
              setNewRoleLabel("");
              setNewRequired(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add verifier
          </Button>
        )}
      </div>

      {/* Notifiers */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notifiers
          </h5>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          Kept informed of activity — no decision authority.
        </p>
        {notifiers.map((n) => {
          const u = orgUsers.find((o) => o.user_id === n.user_id);
          return (
            <div
              key={n.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">
                    {getInitials(u?.full_name, u?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm truncate">{userName(n.user_id)}</p>
                  {n.notify_role && (
                    <p className="text-xs text-muted-foreground truncate">
                      {n.notify_role}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeNotifier.mutate(n.id)}
                aria-label="Remove notifier"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          );
        })}
        {notifiers.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-1">No notifiers added.</p>
        )}
        {addingNotifier ? (
          <div className="space-y-2 rounded-md border border-dashed border-border p-3">
            <div>
              <Label className="text-xs">User</Label>
              <Select value={newNotifier} onValueChange={setNewNotifier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {orgUsers
                    .filter((u) => !notifiers.some((n) => n.user_id === u.user_id))
                    .map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Role / interest (optional)</Label>
              <Input
                value={newNotifierRole}
                onChange={(e) => setNewNotifierRole(e.target.value)}
                placeholder="e.g. PMO, Sponsor's office"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addNotifier.mutate()}>
                Add & notify
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingNotifier(false);
                  setNewNotifier("");
                  setNewNotifierRole("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddingNotifier(true);
              setNewNotifier("");
              setNewNotifierRole("");
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add notifier
          </Button>
        )}
      </div>
    </div>
  );
}

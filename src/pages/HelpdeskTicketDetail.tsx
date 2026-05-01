import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { HelpdeskBreadcrumbs } from "@/components/helpdesk/HelpdeskBreadcrumbs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, MessageSquare, Activity, Save, Clock, Trash2, BookOpen, Paperclip, History as HistoryIcon, Users, Link2, Settings2, Gauge } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn, formatLabel } from "@/lib/utils";
import { SLAStatus } from "@/components/helpdesk/SLAStatus";
import { KBAssistant } from "@/components/kb/KBAssistant";
import { KBInlineSuggestions } from "@/components/kb/KBInlineSuggestions";
import { ResolveTicketDialog, resolutionCodeLabel } from "@/components/helpdesk/ResolveTicketDialog";
import { TicketAttachments } from "@/components/helpdesk/TicketAttachments";
import { EntityAuditTrail } from "@/components/audit/EntityAuditTrail";
import { ParentTicketPicker } from "@/components/helpdesk/ParentTicketPicker";
import {
  CatalogPicker,
  CatalogSummary,
  saveTicketCatalogSelection,
  useTicketCatalogSelection,
  type CatalogSelection,
} from "@/components/helpdesk/CatalogPicker";
import { LinkedCIsPanel } from "@/components/cmdb/LinkedCIsPanel";
import { CatalogRequestPanel } from "@/components/catalog/CatalogRequestPanel";
import { TicketProblemPanel } from "@/components/problems/TicketProblemPanel";
import { TicketMajorIncidentPanel } from "@/components/major-incidents/TicketMajorIncidentPanel";
import { TicketSLAPanel } from "@/components/sla/TicketSLAPanel";
import { TicketCSATPanel } from "@/components/csat/TicketCSATPanel";
import { KBSuggestionsPanel } from "@/components/kb/KBSuggestionsPanel";
import { AIReplyDraftButton } from "@/components/helpdesk/AIReplyDraftButton";
import { MacroPicker } from "@/components/helpdesk/MacroPicker";
import { ApprovalsPanel } from "@/components/helpdesk/ApprovalsPanel";
import { ConvertTicketToTaskDialog } from "@/components/helpdesk/ConvertTicketToTaskDialog";
import { TicketWatchersPanel } from "@/components/helpdesk/TicketWatchersPanel";
import { TicketAssigneesPanel } from "@/components/helpdesk/TicketAssigneesPanel";
import { CommentComposer, renderBodyWithMentions, type PendingFile } from "@/components/helpdesk/CommentComposer";
import { Link } from "react-router-dom";
import { ListChecks, Download, FileText, Image as ImageIcon, Siren } from "lucide-react";
import { DeclareMajorIncidentDialog } from "@/components/major-incidents/DeclareMajorIncidentDialog";


const STATUS_OPTIONS = ["new", "open", "pending", "on_hold", "resolved", "closed", "cancelled"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];
const TYPE_OPTIONS = ["support", "incident", "service_request", "question", "problem"];

function CommentAttachment({ attachment }: { attachment: any }) {
  const isImage = !!attachment.mime_type && attachment.mime_type.startsWith("image/");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("helpdesk-attachments")
      .createSignedUrl(attachment.storage_path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setSignedUrl(data?.signedUrl ?? "");
      })
      .catch(() => {
        if (!cancelled) setSignedUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.storage_path]);
  const handleOpen = () => {
    if (!signedUrl) return;
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  };
  if (isImage) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="group relative block overflow-hidden rounded-md border bg-muted hover:opacity-90"
        title={attachment.file_name}
      >
        {signedUrl ? (
          <img src={signedUrl} alt={attachment.file_name} className="h-32 w-full object-cover" />
        ) : (
          <div className="h-32 w-full flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[10px] truncate px-1 py-0.5">
          {attachment.file_name}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex items-center gap-2 px-2 py-2 rounded-md border hover:bg-muted/50 text-left"
      title={attachment.file_name}
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs truncate flex-1">{attachment.file_name}</span>
      <Download className="h-3 w-3 text-muted-foreground" />
    </button>
  );
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

export default function HelpdeskTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [catalogEditing, setCatalogEditing] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [slaCsatOpen, setSlaCsatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("conversation");
  const [catalogDraft, setCatalogDraft] = useState<CatalogSelection>({});
  const [catalogSaving, setCatalogSaving] = useState(false);
  const { data: catalogSelection = {}, refetch: refetchCatalog } = useTicketCatalogSelection(id);

  const startCatalogEdit = () => {
    setCatalogDraft(catalogSelection);
    setCatalogEditing(true);
  };
  const cancelCatalogEdit = () => {
    setCatalogEditing(false);
    setCatalogDraft({});
  };
  const saveCatalog = async () => {
    if (!ticket) return;
    setCatalogSaving(true);
    try {
      await saveTicketCatalogSelection(
        ticket.id,
        ticket.organization_id,
        catalogDraft,
        user?.id,
      );
      toast.success("Catalog selections updated");
      setCatalogEditing(false);
      await refetchCatalog();
      qc.invalidateQueries({ queryKey: ["hd-ticket-catalog", ticket.id] });
    } catch (e: any) {
      toast.error("Save failed: " + (e?.message ?? "unknown error"));
    } finally {
      setCatalogSaving(false);
    }
  };
  const { accessLevel } = useOrgAccessLevel();
  const isAdmin = accessLevel === "admin";

  const handleDelete = async () => {
    if (!ticket) return;
    setDeleting(true);
    try {
      // Reparent any sub-tickets to this ticket's parent (or null) so they aren't orphaned.
      await supabase
        .from("helpdesk_tickets")
        .update({ parent_ticket_id: (ticket as any).parent_ticket_id ?? null })
        .eq("parent_ticket_id", ticket.id);
      const { error } = await supabase
        .from("helpdesk_tickets")
        .delete()
        .eq("id", ticket.id);
      if (error) {
        toast.error("Delete failed: " + error.message);
        return;
      }
      toast.success("Ticket deleted");
      qc.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      navigate("/support");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["helpdesk-ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["helpdesk-comments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_ticket_comments")
        .select("*")
        .eq("ticket_id", id!)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["helpdesk-activity", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_ticket_activity")
        .select("*")
        .eq("ticket_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: commentAttachments = [] } = useQuery({
    queryKey: ["helpdesk-comment-attachments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_ticket_attachments")
        .select("*")
        .eq("ticket_id", id!)
        .not("comment_id", "is", null);
      return data ?? [];
    },
    enabled: !!id,
  });


  const { data: orgUsers = [] } = useQuery({
    queryKey: ["org-users-min", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data: access } = await supabase
        .from("user_organization_access")
        .select("user_id")
        .eq("organization_id", currentOrganization.id);
      const ids = (access ?? []).map((r: any) => r.user_id).filter(Boolean);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);
      return profiles ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: childTickets = [] } = useQuery({
    queryKey: ["helpdesk-child-tickets", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("id, reference_number, subject, status, priority")
        .eq("parent_ticket_id", id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: parentTicket } = useQuery({
    queryKey: ["helpdesk-parent-ticket", (ticket as any)?.parent_ticket_id],
    queryFn: async () => {
      const pid = (ticket as any)?.parent_ticket_id;
      if (!pid) return null;
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("id, reference_number, subject")
        .eq("id", pid)
        .maybeSingle();
      return data;
    },
    enabled: !!(ticket as any)?.parent_ticket_id,
  });

  const updateFields = async (fields: Record<string, any>, opts?: { skipResolveIntercept?: boolean }) => {
    if (!ticket) return;
    // Intercept status -> resolved unless explicitly skipped (e.g. from the ResolveTicketDialog)
    if (!opts?.skipResolveIntercept && fields.status === "resolved" && ticket.status !== "resolved") {
      setResolveOpen(true);
      return;
    }
    const patch: any = { ...fields };
    if (fields.status === "resolved" && !ticket.resolved_at) patch.resolved_at = new Date().toISOString();
    if (fields.status === "closed" && !ticket.closed_at) patch.closed_at = new Date().toISOString();
    const { error } = await supabase.from("helpdesk_tickets").update(patch).eq("id", ticket.id);
    if (error) {
      toast.error("Update failed: " + error.message);
      return;
    }
    // Activity log per changed field
    for (const [field, value] of Object.entries(fields)) {
      const prev = (ticket as any)[field];
      await supabase.from("helpdesk_ticket_activity").insert({
        ticket_id: ticket.id,
        organization_id: ticket.organization_id,
        actor_user_id: user?.id ?? null,
        event_type: `${field}_changed`,
        from_value: { [field]: prev },
        to_value: { [field]: value },
      });
    }
    if ("assignee_id" in fields && fields.assignee_id) {
      supabase.functions.invoke("helpdesk-notify", {
        body: { ticket_id: ticket.id, notification_type: "assigned" },
      }).catch(() => {});
    }
    if ("status" in fields) {
      const isResolve = fields.status === "resolved" && ticket.status !== "resolved";
      supabase.functions.invoke("helpdesk-notify", {
        body: {
          ticket_id: ticket.id,
          notification_type: isResolve ? "resolved" : "status_changed",
          metadata: isResolve
            ? { resolution_code: fields.resolution_code, resolution: fields.resolution }
            : { new_status: fields.status },
        },
      }).catch(() => {});
    }
    const { dispatchHelpdeskWorkflow } = await import("@/lib/helpdeskWorkflows");
    for (const [field, value] of Object.entries(fields)) {
      const event =
        field === "status" ? "status_changed" :
        field === "assignee_id" ? "assigned" :
        field === "priority" ? "priority_changed" : null;
      if (event) {
        dispatchHelpdeskWorkflow({
          organization_id: ticket.organization_id,
          trigger_event: event as any,
          ticket_id: ticket.id,
          triggered_by: user?.id,
          payload: { from: (ticket as any)[field], to: value, field },
        });
      }
    }
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["helpdesk-ticket", id] });
    qc.invalidateQueries({ queryKey: ["helpdesk-activity", id] });
  };

  const updateField = (field: string, value: any) => updateFields({ [field]: value });

  const handleConfirmResolve = async ({ resolution_code, resolution }: { resolution_code: string; resolution: string }) => {
    setResolving(true);
    await updateFields(
      { status: "resolved", resolution_code, resolution },
      { skipResolveIntercept: true },
    );
    setResolving(false);
    setResolveOpen(false);
  };


  const submitReply = async () => {
    if (!ticket || (!reply.trim() && pendingFiles.length === 0)) return;
    setPosting(true);
    try {
      const { data: comment, error } = await supabase
        .from("helpdesk_ticket_comments")
        .insert({
          ticket_id: ticket.id,
          organization_id: ticket.organization_id,
          author_user_id: user?.id ?? null,
          author_email: user?.email ?? null,
          body: reply.trim(),
          is_internal: internal,
        })
        .select("id")
        .single();
      if (error || !comment) {
        toast.error("Reply failed: " + (error?.message ?? "unknown"));
        return;
      }

      // Upload pending files and link them to this comment
      if (pendingFiles.length > 0 && user) {
        for (const pf of pendingFiles) {
          const safeName = pf.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${ticket.organization_id}/${ticket.id}/${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("helpdesk-attachments")
            .upload(path, pf.file, { contentType: pf.file.type, upsert: false });
          if (upErr) {
            toast.error(`Failed to upload ${pf.file.name}: ${upErr.message}`);
            continue;
          }
          const { error: insErr } = await supabase.from("helpdesk_ticket_attachments").insert({
            ticket_id: ticket.id,
            organization_id: ticket.organization_id,
            comment_id: comment.id,
            uploaded_by: user.id,
            storage_path: path,
            file_name: pf.file.name,
            file_size: pf.file.size,
            mime_type: pf.file.type || null,
            is_internal: internal,
          });
          if (insErr) {
            await supabase.storage.from("helpdesk-attachments").remove([path]);
            toast.error(`Failed to record ${pf.file.name}: ${insErr.message}`);
          }
        }
        // Cleanup blob URLs
        pendingFiles.forEach((pf) => pf.previewUrl && URL.revokeObjectURL(pf.previewUrl));
      }

      // Record @mentions
      if (mentions.length > 0) {
        await supabase.from("helpdesk_comment_mentions").insert(
          mentions.map((uid) => ({
            comment_id: comment.id,
            ticket_id: ticket.id,
            organization_id: ticket.organization_id,
            mentioned_user_id: uid,
            mentioned_by: user?.id ?? null,
          })),
        );
      }

      setReply("");
      setPendingFiles([]);
      setMentions([]);

      if (ticket.status === "new") {
        await supabase.from("helpdesk_tickets").update({
          status: "open",
          first_response_at: ticket.first_response_at ?? new Date().toISOString(),
        }).eq("id", ticket.id);
      }

      // Notify mentioned users (best-effort)
      if (mentions.length > 0) {
        const { data: mProfiles } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", mentions);
        for (const p of mProfiles ?? []) {
          if (!p.email || p.user_id === user?.id) continue;
          supabase.functions.invoke("helpdesk-notify", {
            body: {
              ticket_id: ticket.id,
              notification_type: internal ? "internal_note" : "reply",
              recipient_email: p.email,
              metadata: { comment_body: reply.trim(), mention: true },
            },
          }).catch(() => {});
        }
      }

      // Notify watchers (best-effort)
      const { data: watcherRows } = await supabase
        .from("helpdesk_ticket_watchers")
        .select("user_id")
        .eq("ticket_id", ticket.id);
      const watcherIds = (watcherRows ?? []).map((w: any) => w.user_id).filter((wid: string) => wid !== user?.id);
      if (watcherIds.length > 0) {
        const { data: wProfiles } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", watcherIds);
        for (const p of wProfiles ?? []) {
          if (!p.email) continue;
          supabase.functions.invoke("helpdesk-notify", {
            body: {
              ticket_id: ticket.id,
              notification_type: internal ? "internal_note" : "reply",
              recipient_email: p.email,
              metadata: { comment_body: reply.trim(), watcher: true },
            },
          }).catch(() => {});
        }
      }

      // Look up assignee email so we can fan out to them as well
      let assigneeEmail: string | undefined;
      if (ticket.assignee_id && ticket.assignee_id !== user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", ticket.assignee_id)
          .maybeSingle();
        assigneeEmail = prof?.email ?? undefined;
      }

      if (!internal) {
        supabase.functions.invoke("helpdesk-notify", {
          body: {
            ticket_id: ticket.id,
            notification_type: "reply",
            metadata: { comment_body: reply.trim() },
          },
        }).catch(() => {});
        if (assigneeEmail) {
          supabase.functions.invoke("helpdesk-notify", {
            body: {
              ticket_id: ticket.id,
              notification_type: "reply",
              recipient_email: assigneeEmail,
              metadata: { comment_body: reply.trim() },
            },
          }).catch(() => {});
        }
      } else if (assigneeEmail) {
        supabase.functions.invoke("helpdesk-notify", {
          body: {
            ticket_id: ticket.id,
            notification_type: "internal_note",
            recipient_email: assigneeEmail,
            metadata: { comment_body: reply.trim() },
          },
        }).catch(() => {});
      }

      const { dispatchHelpdeskWorkflow } = await import("@/lib/helpdeskWorkflows");
      dispatchHelpdeskWorkflow({
        organization_id: ticket.organization_id,
        trigger_event: internal ? "internal_note_added" : "replied",
        ticket_id: ticket.id,
        triggered_by: user?.id,
        payload: { body: reply.trim() },
      });
      toast.success("Reply added");
      qc.invalidateQueries({ queryKey: ["helpdesk-comments", id] });
      qc.invalidateQueries({ queryKey: ["helpdesk-comment-attachments", id] });
      qc.invalidateQueries({ queryKey: ["helpdesk-attachments", id] });
      qc.invalidateQueries({ queryKey: ["helpdesk-ticket", id] });
    } finally {
      setPosting(false);
    }
  };


  if (isLoading || !ticket) {
    return <AppLayout title="Ticket"><div className="text-muted-foreground">Loading...</div></AppLayout>;
  }

  return (
    <AppLayout title={ticket.subject} subtitle={ticket.reference_number ?? ""}>
      <div className="space-y-4">
        <HelpdeskBreadcrumbs
          trail={[{ label: ticket.reference_number || ticket.subject || "Ticket" }]}
        />
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/support")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Helpdesk
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete ticket
            </Button>
          )}
        </div>

        {/* Top Properties bar */}
        <Card className="p-4 mb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1 min-w-[140px] flex-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={ticket.status} onValueChange={(v) => updateField("status", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[140px] flex-1">
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select value={ticket.priority} onValueChange={(v) => updateField("priority", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[140px] flex-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={ticket.ticket_type} onValueChange={(v) => updateField("ticket_type", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPE_OPTIONS.map(s => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[180px] flex-1">
              <Label className="text-xs text-muted-foreground">Primary Assignee</Label>
              <p className="text-sm h-8 flex items-center truncate">
                {ticket.assignee_id
                  ? (orgUsers.find((u: any) => u.user_id === ticket.assignee_id)?.full_name
                      || orgUsers.find((u: any) => u.user_id === ticket.assignee_id)?.email
                      || "Assigned")
                  : <span className="text-muted-foreground">Unassigned</span>}
              </p>
            </div>
            {ticket.category && (
              <div className="space-y-1 min-w-[140px]">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <p className="text-sm h-8 flex items-center truncate">{ticket.category}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {ticket.status !== "resolved" && ticket.status !== "closed" && ticket.status !== "cancelled" && (
                <Button size="sm" onClick={() => setResolveOpen(true)}>
                  Mark as Resolved…
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/timesheets?ticketId=${ticket.id}`)}
              >
                <Clock className="h-4 w-4 mr-2" /> Log time
              </Button>
              <Button size="sm" variant="outline" onClick={() => setResolutionOpen(true)}>
                Resolution
                {(ticket as any).resolution_code && <span className="ml-1 text-[10px] opacity-70">●</span>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSlaCsatOpen(true)}>
                <Gauge className="h-4 w-4 mr-1" /> SLA / CSAT
              </Button>
              <Button size="sm" variant="outline" onClick={() => setActiveTab("links")}>
                <Link2 className="h-4 w-4 mr-1" /> Links
              </Button>
              {(ticket as any).converted_to_task_id ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/tasks?focus=${(ticket as any).converted_to_task_id}`)}
                >
                  <ListChecks className="h-4 w-4 mr-1" /> Open task
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConvertOpen(true)}>
                  <ListChecks className="h-4 w-4 mr-1" /> To task
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 items-start">
          {/* Main */}
          <div className="space-y-4 min-w-0">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{ticket.subject}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Reported by {ticket.reporter_name || ticket.reporter_email || "—"}
                    {ticket.created_at && ` · ${format(new Date(ticket.created_at), "PPp")}`}
                  </p>
                </div>
                <Badge className={cn(STATUS_STYLES[ticket.status])}>{formatLabel(ticket.status)}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm">{ticket.description || <span className="text-muted-foreground">No description</span>}</p>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="conversation"><MessageSquare className="h-4 w-4 mr-2" />Conversation ({comments.length})</TabsTrigger>
                <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-2" />Activity ({activity.length})</TabsTrigger>
                <TabsTrigger value="people"><Users className="h-4 w-4 mr-2" />People</TabsTrigger>
                <TabsTrigger value="links"><Link2 className="h-4 w-4 mr-2" />Links</TabsTrigger>
                <TabsTrigger value="knowledge"><BookOpen className="h-4 w-4 mr-2" />Knowledge</TabsTrigger>
                <TabsTrigger value="attachments"><Paperclip className="h-4 w-4 mr-2" />Attachments</TabsTrigger>
                <TabsTrigger value="audit"><HistoryIcon className="h-4 w-4 mr-2" />Audit</TabsTrigger>
              </TabsList>
              <TabsContent value="conversation" className="space-y-3">
                {comments.length === 0 && <p className="text-sm text-muted-foreground">No replies yet.</p>}
                {comments.map((c: any) => {
                  const atts = (commentAttachments as any[]).filter((a) => a.comment_id === c.id);
                  return (
                    <Card key={c.id} className={cn("p-4", c.is_internal && "bg-warning/5 border-warning/30")}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{c.author_email || "System"}</span>
                        <div className="flex items-center gap-2">
                          {c.is_internal && <Badge variant="outline" className="text-xs">Internal</Badge>}
                          {c.is_from_email && <Badge variant="outline" className="text-xs">Email</Badge>}
                          <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), "PPp")}</span>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{renderBodyWithMentions(c.body ?? "", orgUsers as any)}</p>
                      {atts.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {atts.map((a: any) => (
                            <CommentAttachment key={a.id} attachment={a} />
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
                <Card className="p-4 space-y-3">
                  <CommentComposer
                    value={reply}
                    onChange={setReply}
                    users={orgUsers as any}
                    pendingFiles={pendingFiles}
                    onPendingFilesChange={setPendingFiles}
                    onMentionsChange={setMentions}
                    disabled={posting}
                  />
                  <div className="flex items-center justify-between flex-wrap gap-2">
                     <div className="flex items-center gap-2">
                       <Switch checked={internal} onCheckedChange={setInternal} id="internal" />
                       <Label htmlFor="internal" className="text-sm">Internal note</Label>
                     </div>
                     <div className="flex items-center gap-2 flex-wrap">
                       <MacroPicker
                         ticketId={ticket.id}
                         context={{
                           ticket: {
                             reference_number: (ticket as any).reference_number,
                             subject: ticket.subject,
                             status: ticket.status,
                             priority: ticket.priority,
                             type: (ticket as any).type,
                           },
                           customer: {
                             first_name: (ticket as any).requester_first_name,
                             last_name: (ticket as any).requester_last_name,
                             email: (ticket as any).requester_email,
                           },
                           organization: { name: currentOrganization?.name },
                         }}
                         onInsert={(text) => setReply((prev) => (prev ? prev + "\n\n" + text : text))}
                       />
                       <AIReplyDraftButton ticketId={ticket.id} onDraft={(text) => setReply(text)} />
                       <Button
                         onClick={submitReply}
                         disabled={posting || (!reply.trim() && pendingFiles.length === 0)}
                       >
                         {posting ? "Posting…" : "Post Reply"}
                       </Button>
                     </div>
                   </div>
                </Card>
              </TabsContent>
              <TabsContent value="activity" className="space-y-2">
                {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
                {activity.map((a: any) => {
                  const renderValue = (v: any): string => {
                    if (v === null || v === undefined || v === "") return "—";
                    if (typeof v === "object") {
                      const vals = Object.values(v).filter(x => x !== null && x !== undefined && x !== "");
                      if (vals.length === 0) return "—";
                      return vals.map(x => {
                        if (x === null || x === undefined) return "—";
                        if (typeof x === "object") return JSON.stringify(x);
                        const s = String(x);
                        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
                          const u = (orgUsers as any[]).find(o => o.user_id === s);
                          return u ? (u.full_name || u.email || s) : s;
                        }
                        return formatLabel(s);
                      }).join(", ");
                    }
                    return formatLabel(String(v));
                  };
                  const actor = (orgUsers as any[]).find(o => o.user_id === a.actor_user_id);
                  const actorName = actor ? (actor.full_name || actor.email) : (a.actor_user_id ? "Unknown user" : "System");
                  const eventLabel = formatLabel(a.event_type.replace(/_changed$/, "").replace(/_/g, " ")) +
                    (a.event_type.endsWith("_changed") ? " changed" : "");
                  return (
                    <div key={a.id} className="flex gap-3 text-sm border-l-2 border-muted pl-3 py-2">
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">{eventLabel}</p>
                        <p className="text-xs text-muted-foreground">by {actorName}</p>
                        {(a.from_value || a.to_value) && (
                          <div className="flex items-center gap-2 text-xs">
                            {a.from_value && (
                              <Badge variant="outline" className="text-xs font-normal">{renderValue(a.from_value)}</Badge>
                            )}
                            {a.from_value && a.to_value && <span className="text-muted-foreground">→</span>}
                            {a.to_value && (
                              <Badge variant="secondary" className="text-xs font-normal">{renderValue(a.to_value)}</Badge>
                            )}
                          </div>
                        )}
                        {a.notes && <p className="text-xs text-muted-foreground italic">{a.notes}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(a.created_at), "PPp")}</span>
                    </div>
                  );
                })}
              </TabsContent>
              <TabsContent value="people" className="space-y-4">
                <TicketAssigneesPanel
                  ticketId={ticket.id}
                  organizationId={ticket.organization_id}
                  orgUsers={orgUsers as any}
                />
                <TicketWatchersPanel
                  ticketId={ticket.id}
                  organizationId={ticket.organization_id}
                  orgUsers={orgUsers as any}
                />
              </TabsContent>
              <TabsContent value="links" className="space-y-4">
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Hierarchy</h3>
                    {childTickets.length > 0 && (
                      <Badge variant="outline">{childTickets.length} sub-ticket{childTickets.length === 1 ? "" : "s"}</Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Parent ticket</Label>
                    <ParentTicketPicker
                      currentTicketId={ticket.id}
                      value={(ticket as any).parent_ticket_id ?? null}
                      onChange={(parentId) => updateField("parent_ticket_id", parentId)}
                    />
                    {parentTicket && (
                      <button
                        type="button"
                        onClick={() => navigate(`/support/tickets/${parentTicket.id}`)}
                        className="text-xs text-primary hover:underline truncate block max-w-full text-left"
                      >
                        Open parent: {parentTicket.reference_number ?? ""} {parentTicket.subject ?? ""}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Sub-tickets ({childTickets.length})
                    </Label>
                    {childTickets.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No sub-tickets linked.</p>
                    ) : (
                      <ul className="space-y-1">
                        {childTickets.map((c: any) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => navigate(`/support/tickets/${c.id}`)}
                              className="w-full flex items-center gap-2 text-left text-sm hover:bg-muted rounded px-2 py-1"
                            >
                              <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                                {c.reference_number ?? c.id.slice(0, 6)}
                              </span>
                              <span className="truncate flex-1">{c.subject}</span>
                              <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                                {formatLabel(c.status)}
                              </Badge>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Catalog selections</h3>
                    {!catalogEditing ? (
                      <Button size="sm" variant="outline" onClick={startCatalogEdit}>Edit</Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={cancelCatalogEdit} disabled={catalogSaving}>Cancel</Button>
                        <Button size="sm" onClick={saveCatalog} disabled={catalogSaving}>
                          {catalogSaving ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    )}
                  </div>
                  {catalogEditing ? (
                    <CatalogPicker
                      value={catalogDraft}
                      onChange={setCatalogDraft}
                      ticketType={ticket.ticket_type}
                      compact
                    />
                  ) : (
                    <CatalogSummary ticketId={ticket.id} />
                  )}
                </Card>

                <Card className="p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Related items</h3>
                  <LinkedCIsPanel ticketId={ticket.id} />
                  <CatalogRequestPanel ticketId={ticket.id} />
                  <TicketProblemPanel
                    ticketId={ticket.id}
                    ticketSubject={ticket.subject}
                    ticketDescription={ticket.description}
                    parentProblemId={(ticket as any).parent_problem_id ?? null}
                  />
                  <TicketMajorIncidentPanel
                    ticketId={ticket.id}
                    ticketSubject={ticket.subject}
                    ticketDescription={ticket.description}
                  />
                  <div className="text-sm space-y-1 pt-2 border-t">
                    <p><span className="text-muted-foreground">Programme:</span> {ticket.programme_id ? <code className="text-xs">{ticket.programme_id.slice(0, 8)}</code> : "—"}</p>
                    <p><span className="text-muted-foreground">Project:</span> {ticket.project_id ? <code className="text-xs">{ticket.project_id.slice(0, 8)}</code> : "—"}</p>
                    <p><span className="text-muted-foreground">Product:</span> {ticket.product_id ? <code className="text-xs">{ticket.product_id.slice(0, 8)}</code> : "—"}</p>
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Approvals</h3>
                  <ApprovalsPanel ticketId={ticket.id} />
                </Card>
              </TabsContent>
              <TabsContent value="knowledge" className="space-y-4">
                <KBSuggestionsPanel
                  organizationId={ticket.organization_id}
                  query={`${ticket.subject || ""}\n\n${ticket.description || ""}`}
                  ticketId={ticket.id}
                  context="agent_reply"
                />
                <KBInlineSuggestions subject={ticket.subject} description={ticket.description ?? ""} />
                <KBAssistant surface="agent" ticketId={ticket.id} placeholder="Ask the KB for a suggested reply…" />
              </TabsContent>
              <TabsContent value="attachments" className="space-y-4">
                <TicketAttachments ticketId={ticket.id} organizationId={ticket.organization_id} />
              </TabsContent>
              <TabsContent value="audit">
                <EntityAuditTrail entityType="helpdesk_ticket" entityId={ticket.id} title="Ticket Audit Trail" />
              </TabsContent>
            </Tabs>
          </div>

        </div>
      </div>


      <ResolveTicketDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        defaultCode={(ticket as any).resolution_code ?? null}
        defaultNotes={ticket.resolution ?? null}
        submitting={resolving}
        onConfirm={handleConfirmResolve}
      />

      <ConvertTicketToTaskDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        ticket={ticket as any}
        onConverted={() => qc.invalidateQueries({ queryKey: ["helpdesk-ticket", id] })}
      />

      <Dialog open={resolutionOpen} onOpenChange={setResolutionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Resolution notes
              {(ticket as any).resolution_code && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {resolutionCodeLabel((ticket as any).resolution_code)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            rows={6}
            defaultValue={ticket.resolution ?? ""}
            key={`res-dlg-${ticket.id}-${ticket.resolution ?? ""}`}
            onBlur={(e) => {
              if (e.target.value !== (ticket.resolution ?? "")) {
                updateField("resolution", e.target.value || null);
              }
            }}
            placeholder="Resolution details..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolutionOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={slaCsatOpen} onOpenChange={setSlaCsatOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>SLA &amp; CSAT</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TicketSLAPanel ticket={ticket} />
            <TicketCSATPanel ticket={ticket} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlaCsatOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => !deleting && setDeleteOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {ticket.reference_number ?? "ticket"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes "{ticket.subject}" along with all comments,
              activity, and attachments. Any sub-tickets will be moved up to this
              ticket's parent (or to the top level). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

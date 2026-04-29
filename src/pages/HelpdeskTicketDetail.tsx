import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, MessageSquare, Activity, Save, Clock } from "lucide-react";
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

const STATUS_OPTIONS = ["new", "open", "pending", "on_hold", "resolved", "closed", "cancelled"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];
const TYPE_OPTIONS = ["support", "incident", "service_request", "question", "problem"];

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
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

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
    if (!ticket || !reply.trim()) return;
    const { error } = await supabase.from("helpdesk_ticket_comments").insert({
      ticket_id: ticket.id,
      organization_id: ticket.organization_id,
      author_user_id: user?.id ?? null,
      author_email: user?.email ?? null,
      body: reply.trim(),
      is_internal: internal,
    });
    if (error) {
      toast.error("Reply failed: " + error.message);
      return;
    }
    setReply("");
    if (ticket.status === "new") {
      await supabase.from("helpdesk_tickets").update({
        status: "open",
        first_response_at: ticket.first_response_at ?? new Date().toISOString(),
      }).eq("id", ticket.id);
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
      // Notify the reporter (default recipient resolution)
      supabase.functions.invoke("helpdesk-notify", {
        body: {
          ticket_id: ticket.id,
          notification_type: "reply",
          metadata: { comment_body: reply.trim() },
        },
      }).catch(() => {});
      // Also notify the assignee, if there is one and it isn't the author
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
      // Internal note: notify assignee only (never the reporter)
      supabase.functions.invoke("helpdesk-notify", {
        body: {
          ticket_id: ticket.id,
          notification_type: "internal_note",
          recipient_email: assigneeEmail,
          metadata: { comment_body: reply.trim() },
        },
      }).catch(() => {});
    }
    // Dispatch workflows for reply / internal note
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
    qc.invalidateQueries({ queryKey: ["helpdesk-ticket", id] });
  };

  if (isLoading || !ticket) {
    return <AppLayout title="Ticket"><div className="text-muted-foreground">Loading...</div></AppLayout>;
  }

  return (
    <AppLayout title={ticket.subject} subtitle={ticket.reference_number ?? ""}>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/support")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Helpdesk
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-4">
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

            <Tabs defaultValue="conversation">
              <TabsList>
                <TabsTrigger value="conversation"><MessageSquare className="h-4 w-4 mr-2" />Conversation ({comments.length})</TabsTrigger>
                <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-2" />Activity ({activity.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="conversation" className="space-y-3">
                {comments.length === 0 && <p className="text-sm text-muted-foreground">No replies yet.</p>}
                {comments.map((c: any) => (
                  <Card key={c.id} className={cn("p-4", c.is_internal && "bg-warning/5 border-warning/30")}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{c.author_email || "System"}</span>
                      <div className="flex items-center gap-2">
                        {c.is_internal && <Badge variant="outline" className="text-xs">Internal</Badge>}
                        {c.is_from_email && <Badge variant="outline" className="text-xs">Email</Badge>}
                        <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), "PPp")}</span>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                  </Card>
                ))}
                <Card className="p-4 space-y-3">
                  <Textarea
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your reply..."
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={internal} onCheckedChange={setInternal} id="internal" />
                      <Label htmlFor="internal" className="text-sm">Internal note</Label>
                    </div>
                    <Button onClick={submitReply} disabled={!reply.trim()}>Post Reply</Button>
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
                        // If looks like a UUID, try to resolve to a user name
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
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="p-4 space-y-4">
              <h3 className="font-semibold">Properties</h3>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={ticket.status} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={ticket.priority} onValueChange={(v) => updateField("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={ticket.ticket_type} onValueChange={(v) => updateField("ticket_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPE_OPTIONS.map(s => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Assignee</Label>
                <Select value={ticket.assignee_id ?? "none"} onValueChange={(v) => updateField("assignee_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {orgUsers.map((u: any) => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <p className="text-sm">{ticket.category || "—"}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Source</Label>
                <Badge variant="outline">{ticket.source}</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate(`/timesheets?ticketId=${ticket.id}`)}
              >
                <Clock className="h-4 w-4 mr-2" /> Log time on this ticket
              </Button>
            </Card>

            <SLAStatus
              createdAt={ticket.created_at}
              responseDueAt={(ticket as any).sla_response_due_at}
              resolutionDueAt={(ticket as any).sla_resolution_due_at}
              firstResponseAt={ticket.first_response_at}
              resolvedAt={ticket.resolved_at}
              responseBreached={(ticket as any).sla_response_breached ?? false}
              resolutionBreached={(ticket as any).sla_resolution_breached ?? false}
              status={ticket.status}
            />

            <Card className="p-4 space-y-2">
              <h3 className="font-semibold">Linked</h3>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Programme:</span> {ticket.programme_id ? <code className="text-xs">{ticket.programme_id.slice(0, 8)}</code> : "—"}</p>
                <p><span className="text-muted-foreground">Project:</span> {ticket.project_id ? <code className="text-xs">{ticket.project_id.slice(0, 8)}</code> : "—"}</p>
                <p><span className="text-muted-foreground">Product:</span> {ticket.product_id ? <code className="text-xs">{ticket.product_id.slice(0, 8)}</code> : "—"}</p>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Resolution</h3>
                {(ticket as any).resolution_code && (
                  <Badge variant="outline">{resolutionCodeLabel((ticket as any).resolution_code)}</Badge>
                )}
              </div>
              <Textarea
                rows={4}
                defaultValue={ticket.resolution ?? ""}
                key={`res-${ticket.id}-${ticket.resolution ?? ""}`}
                onBlur={(e) => {
                  if (e.target.value !== (ticket.resolution ?? "")) {
                    updateField("resolution", e.target.value || null);
                  }
                }}
                placeholder="Resolution details..."
              />
              {ticket.status !== "resolved" && ticket.status !== "closed" && ticket.status !== "cancelled" && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setResolveOpen(true)}>
                  Mark as Resolved…
                </Button>
              )}
            </Card>

            <TicketAttachments ticketId={ticket.id} organizationId={ticket.organization_id} />

            <KBInlineSuggestions subject={ticket.subject} description={ticket.description ?? ""} />

            <KBAssistant surface="agent" ticketId={ticket.id} placeholder="Ask the KB for a suggested reply…" />
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
    </AppLayout>
  );
}

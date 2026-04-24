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
import { ArrowLeft, MessageSquare, Activity, Save } from "lucide-react";
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

  const updateField = async (field: string, value: any) => {
    if (!ticket) return;
    const prev = (ticket as any)[field];
    const patch: any = { [field]: value };
    if (field === "status" && value === "resolved" && !ticket.resolved_at) patch.resolved_at = new Date().toISOString();
    if (field === "status" && value === "closed" && !ticket.closed_at) patch.closed_at = new Date().toISOString();
    const { error } = await supabase.from("helpdesk_tickets").update(patch).eq("id", ticket.id);
    if (error) {
      toast.error("Update failed: " + error.message);
      return;
    }
    await supabase.from("helpdesk_ticket_activity").insert({
      ticket_id: ticket.id,
      organization_id: ticket.organization_id,
      actor_user_id: user?.id ?? null,
      event_type: `${field}_changed`,
      from_value: { [field]: prev },
      to_value: { [field]: value },
    });
    if (field === "assignee_id" && value) {
      supabase.functions.invoke("helpdesk-notify", {
        body: { ticket_id: ticket.id, notification_type: "assigned" },
      }).catch(() => {});
    }
    if (field === "status") {
      supabase.functions.invoke("helpdesk-notify", {
        body: { ticket_id: ticket.id, notification_type: "status_changed", metadata: { new_status: value } },
      }).catch(() => {});
    }
    // Dispatch workflows
    const { dispatchHelpdeskWorkflow } = await import("@/lib/helpdeskWorkflows");
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
        payload: { from: prev, to: value, field },
      });
    }
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["helpdesk-ticket", id] });
    qc.invalidateQueries({ queryKey: ["helpdesk-activity", id] });
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
    if (!internal) {
      supabase.functions.invoke("helpdesk-notify", {
        body: {
          ticket_id: ticket.id,
          notification_type: "reply",
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
                {activity.map((a: any) => (
                  <div key={a.id} className="flex gap-3 text-sm border-l-2 border-muted pl-3">
                    <div className="flex-1">
                      <p className="font-medium">{a.event_type.replace(/_/g, " ")}</p>
                      {a.from_value && a.to_value && (
                        <p className="text-xs text-muted-foreground">
                          {JSON.stringify(a.from_value)} → {JSON.stringify(a.to_value)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "PPp")}</span>
                  </div>
                ))}
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

            <Card className="p-4 space-y-2">
              <h3 className="font-semibold">Resolution</h3>
              <Textarea
                rows={4}
                defaultValue={ticket.resolution ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (ticket.resolution ?? "")) {
                    updateField("resolution", e.target.value || null);
                  }
                }}
                placeholder="Resolution details..."
              />
            </Card>

            <KBInlineSuggestions subject={ticket.subject} description={ticket.description ?? ""} />

            <KBAssistant surface="agent" ticketId={ticket.id} placeholder="Ask the KB for a suggested reply…" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

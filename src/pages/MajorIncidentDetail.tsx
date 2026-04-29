import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, MessageSquare, Megaphone, FileText, Ticket, Globe } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const SEV_STYLES: Record<string, string> = {
  sev1: "bg-destructive text-destructive-foreground",
  sev2: "bg-destructive/10 text-destructive",
  sev3: "bg-warning/10 text-warning",
  sev4: "bg-muted text-muted-foreground",
};

const STATUS_OPTIONS = ["investigating", "identified", "monitoring", "resolved", "closed"];

export default function MajorIncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();

  const [updateMessage, setUpdateMessage] = useState("");
  const [updateType, setUpdateType] = useState("note");
  const [updateIsPublic, setUpdateIsPublic] = useState(false);

  const { data: incident, isLoading } = useQuery({
    queryKey: ["major-incident", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("major_incidents").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: updates = [] } = useQuery({
    queryKey: ["major-incident-updates", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("major_incident_updates")
        .select("*")
        .eq("major_incident_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: linkedTickets = [] } = useQuery({
    queryKey: ["major-incident-tickets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("major_incident_tickets")
        .select("ticket_id, helpdesk_tickets(id, ticket_number, subject, status, priority)")
        .eq("major_incident_id", id!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("major_incidents").update({ status } as any).eq("id", id!);
      if (error) throw error;
      const { data: user } = await supabase.auth.getUser();
      await supabase.from("major_incident_updates").insert({
        major_incident_id: id!,
        organization_id: currentOrganization!.id,
        update_type: "status_change",
        message: `Status changed to ${status}`,
        is_public: false,
        posted_by: user.user?.id,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["major-incident", id] });
      qc.invalidateQueries({ queryKey: ["major-incident-updates", id] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const postUpdate = useMutation({
    mutationFn: async () => {
      if (!updateMessage.trim()) throw new Error("Message is required");
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("major_incident_updates").insert({
        major_incident_id: id!,
        organization_id: currentOrganization!.id,
        update_type: updateType,
        message: updateMessage,
        is_public: updateIsPublic,
        posted_by: user.user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setUpdateMessage("");
      qc.invalidateQueries({ queryKey: ["major-incident-updates", id] });
      toast.success("Update posted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const savePostMortem = useMutation({
    mutationFn: async (post_mortem: string) => {
      const { error } = await supabase.from("major_incidents").update({ post_mortem } as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["major-incident", id] });
      toast.success("Post-mortem saved");
    },
  });

  if (isLoading || !incident) {
    return <AppLayout title="Major Incident"><div className="p-6">Loading...</div></AppLayout>;
  }

  const inc: any = incident;

  return (
    <AppLayout title="Major Incident">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/major-incidents")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <span className="font-mono text-sm text-muted-foreground">{inc.reference_number}</span>
          <Badge className={SEV_STYLES[inc.severity]}>{inc.severity.toUpperCase()}</Badge>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{inc.title}</h1>
            {inc.impact && <p className="text-sm text-muted-foreground mt-1">{inc.impact}</p>}
          </div>
          <Select value={inc.status} onValueChange={(v) => updateStatus.mutate(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Declared</div><div>{format(new Date(inc.declared_at), "PPp")}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Resolved</div><div>{inc.resolved_at ? format(new Date(inc.resolved_at), "PPp") : "—"}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Linked Tickets</div><div>{linkedTickets.length}</div></Card>
        </div>

        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline"><MessageSquare className="h-4 w-4 mr-1" /> Timeline</TabsTrigger>
            <TabsTrigger value="tickets"><Ticket className="h-4 w-4 mr-1" /> Tickets ({linkedTickets.length})</TabsTrigger>
            <TabsTrigger value="postmortem"><FileText className="h-4 w-4 mr-1" /> Post-Mortem</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4">
            <Card className="p-4 space-y-3">
              <div className="font-medium flex items-center gap-2"><Megaphone className="h-4 w-4" /> Post Update</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={updateType} onValueChange={setUpdateType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="comms">Communication</SelectItem>
                      <SelectItem value="action">Action Taken</SelectItem>
                      <SelectItem value="decision">Decision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch id="public" checked={updateIsPublic} onCheckedChange={setUpdateIsPublic} />
                  <Label htmlFor="public" className="flex items-center gap-1"><Globe className="h-3 w-3" /> Public (status page)</Label>
                </div>
              </div>
              <Textarea value={updateMessage} onChange={(e) => setUpdateMessage(e.target.value)} placeholder="Update message..." rows={3} />
              <Button onClick={() => postUpdate.mutate()} disabled={!updateMessage.trim() || postUpdate.isPending}>Post Update</Button>
            </Card>

            <div className="space-y-3">
              {updates.map((u: any) => (
                <Card key={u.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{u.update_type}</Badge>
                      {u.is_public && <Badge variant="secondary"><Globe className="h-3 w-3 mr-1" /> Public</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(u.created_at), "PPp")}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{u.message}</p>
                </Card>
              ))}
              {updates.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No updates yet</p>}
            </div>
          </TabsContent>

          <TabsContent value="tickets">
            <Card className="p-4 space-y-2">
              {linkedTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No linked tickets</p>
              ) : linkedTickets.map((lt: any) => lt.helpdesk_tickets && (
                <Link key={lt.ticket_id} to={`/support/tickets/${lt.ticket_id}`} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{lt.helpdesk_tickets.ticket_number}</div>
                    <div className="font-medium">{lt.helpdesk_tickets.subject}</div>
                  </div>
                  <Badge variant="outline">{lt.helpdesk_tickets.status}</Badge>
                </Link>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="postmortem">
            <Card className="p-4 space-y-3">
              <Label>Post-Mortem (root cause, timeline, lessons learned, action items)</Label>
              <Textarea
                defaultValue={inc.post_mortem ?? ""}
                onBlur={(e) => e.target.value !== (inc.post_mortem ?? "") && savePostMortem.mutate(e.target.value)}
                rows={16}
                placeholder="## Summary&#10;## Timeline&#10;## Root Cause&#10;## Resolution&#10;## Lessons Learned&#10;## Action Items"
              />
              <p className="text-xs text-muted-foreground">Auto-saves on blur</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

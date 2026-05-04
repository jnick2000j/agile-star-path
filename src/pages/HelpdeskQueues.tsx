import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Users, UserPlus, X } from "lucide-react";

export default function HelpdeskQueues({ embedded = false }: { embedded?: boolean } = {}) {
  const { currentOrganization } = useOrganization();
  const [queues, setQueues] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [profiles, setProfiles] = useState<any[]>([]);
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const orgId = currentOrganization.id;
    const [{ data: q }, { data: access }, { data: ib }] = await Promise.all([
      (supabase as any).from("helpdesk_queues").select("*").eq("organization_id", orgId).order("name"),
      (supabase as any).from("user_organization_access").select("user_id").eq("organization_id", orgId).eq("is_disabled", false),
      (supabase as any).from("helpdesk_email_inboxes").select("id, email_address, queue_id").eq("organization_id", orgId),
    ]);
    setQueues(q || []);
    const userIds = (access || []).map((a: any) => a.user_id);
    let profs: any[] = [];
    if (userIds.length) {
      const { data: pp } = await (supabase as any).from("profiles").select("user_id, first_name, last_name, full_name, email").in("user_id", userIds);
      profs = (pp || []).map((p: any) => ({ ...p, id: p.user_id }));
    }
    setProfiles(profs);
    setInboxes(ib || []);
    if (q?.length) {
      const { data: m } = await (supabase as any)
        .from("helpdesk_queue_members")
        .select("*")
        .in("queue_id", q.map((x: any) => x.id));
      const byQueue: Record<string, any[]> = {};
      (m || []).forEach((row: any) => {
        (byQueue[row.queue_id] ||= []).push(row);
      });
      setMembers(byQueue);
    } else {
      setMembers({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentOrganization?.id]);

  const deleteQueue = async (id: string) => {
    if (!confirm("Delete this queue? Members and links will be removed.")) return;
    const { error } = await (supabase as any).from("helpdesk_queues").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Queue deleted");
    load();
  };

  const toggleActive = async (q: any) => {
    await (supabase as any).from("helpdesk_queues").update({ is_active: !q.is_active }).eq("id", q.id);
    load();
  };

  const profileLabel = (id: string) => {
    const p = profiles.find((x) => x?.id === id);
    if (!p) return id.slice(0, 8);
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || id.slice(0, 8);
  };

  const body = (
    <div className={embedded ? "space-y-4" : "container mx-auto py-6 space-y-6"}>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Helpdesk Queues</h1>
          <p className="text-muted-foreground">Group agents into queues. Link inboxes to a queue and notify all members on assignment.</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Queue</Button></DialogTrigger>
          <QueueDialog
            orgId={currentOrganization?.id}
            profiles={profiles}
            onClose={() => { setOpenCreate(false); load(); }}
          />
        </Dialog>
      </div>

      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : !queues.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No queues yet. Create one to start grouping agents and routing inbound email.
        </CardContent></Card>
      ) : queues.map((q) => {
        const qMembers = members[q.id] || [];
        const linkedInboxes = inboxes.filter((i) => i.queue_id === q.id);
        return (
          <Card key={q.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-md flex items-center justify-center" style={{ backgroundColor: (q.color || '#3b82f6') + '22', color: q.color || '#3b82f6' }}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{q.name}</h3>
                      <Badge variant={q.is_active ? "default" : "secondary"}>{q.is_active ? "Active" : "Disabled"}</Badge>
                      <Badge variant="outline" className="capitalize">Default: {q.default_priority}</Badge>
                      <Badge variant="outline">{qMembers.length} member{qMembers.length === 1 ? '' : 's'}</Badge>
                    </div>
                    {q.description && <p className="text-sm text-muted-foreground mt-1">{q.description}</p>}
                    {linkedInboxes.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Linked inboxes: {linkedInboxes.map((i) => i.email_address).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={q.is_active} onCheckedChange={() => toggleActive(q)} />
                  <Button size="sm" variant="outline" onClick={() => setEditing(q)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteQueue(q.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              <QueueMembersEditor
                queueId={q.id}
                members={qMembers}
                profiles={profiles}
                profileLabel={profileLabel}
                onChange={load}
              />
            </CardContent>
          </Card>
        );
      })}

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <QueueDialog
            orgId={currentOrganization?.id}
            profiles={profiles}
            existing={editing}
            onClose={() => { setEditing(null); load(); }}
          />
        </Dialog>
      )}
    </div>
  );

  return embedded ? body : <AppLayout title="Helpdesk Queues">{body}</AppLayout>;
}

function QueueMembersEditor({ queueId, members, profiles, profileLabel, onChange }: any) {
  const [adding, setAdding] = useState("");

  const addMember = async () => {
    if (!adding) return;
    const { error } = await (supabase as any).from("helpdesk_queue_members").insert({ queue_id: queueId, user_id: adding });
    if (error) { toast.error(error.message); return; }
    setAdding("");
    onChange();
  };
  const removeMember = async (id: string) => {
    await (supabase as any).from("helpdesk_queue_members").delete().eq("id", id);
    onChange();
  };

  const memberIds = new Set(members.map((m: any) => m.user_id));
  const available = profiles.filter((p: any) => p && !memberIds.has(p.id));

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {members.length === 0 && <span className="text-xs text-muted-foreground">No members yet.</span>}
        {members.map((m: any) => (
          <Badge key={m.id} variant="secondary" className="gap-1">
            {profileLabel(m.user_id)}
            <button onClick={() => removeMember(m.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Select value={adding} onValueChange={setAdding}>
          <SelectTrigger className="h-8 max-w-xs"><SelectValue placeholder="Add member…" /></SelectTrigger>
          <SelectContent>
            {available.length === 0 ? <div className="px-2 py-1 text-xs text-muted-foreground">All org members already added</div> :
              available.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={addMember} disabled={!adding}><UserPlus className="h-4 w-4 mr-1" />Add</Button>
      </div>
    </div>
  );
}

function QueueDialog({ orgId, profiles, existing, onClose }: { orgId?: string; profiles: any[]; existing?: any; onClose: () => void }) {
  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [color, setColor] = useState(existing?.color || "#3b82f6");
  const [priority, setPriority] = useState(existing?.default_priority || "medium");
  const [defaultAssignee, setDefaultAssignee] = useState(existing?.default_assignee_id || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name || !orgId) return;
    setSaving(true);
    const payload: any = {
      organization_id: orgId,
      name: name.trim(),
      description: description || null,
      color,
      default_priority: priority,
      default_assignee_id: defaultAssignee || null,
    };
    const { error } = existing
      ? await (supabase as any).from("helpdesk_queues").update(payload).eq("id", existing.id)
      : await (supabase as any).from("helpdesk_queues").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(existing ? "Queue updated" : "Queue created");
    onClose();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{existing ? "Edit Queue" : "New Queue"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tier 1 Support" /></div>
        <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Color</Label>
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
          </div>
          <div>
            <Label>Default Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["low","medium","high","urgent"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Default Assignee (optional)</Label>
          <Select value={defaultAssignee || "__none"} onValueChange={(v) => setDefaultAssignee(v === "__none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="No default assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No default assignee</SelectItem>
              {profiles.map((p: any) => p && (
                <SelectItem key={p.id} value={p.id}>
                  {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving || !name}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{existing ? "Save" : "Create Queue"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

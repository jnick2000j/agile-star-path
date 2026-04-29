import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Plus, Loader2, Code, Globe, Mail, Trash2 } from "lucide-react";
import { format } from "date-fns";

const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const INTAKE_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/ticket-intake`;

export default function TicketIntake({ embedded = false }: { embedded?: boolean } = {}) {
  const { currentOrganization } = useOrganization();
  const [channels, setChannels] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const [{ data: ch }, { data: subs }] = await Promise.all([
      (supabase as any).from("helpdesk_intake_channels").select("*").eq("organization_id", currentOrganization.id).order("created_at", { ascending: false }),
      (supabase as any).from("helpdesk_intake_submissions").select("*").eq("organization_id", currentOrganization.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setChannels(ch || []);
    setSubmissions(subs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentOrganization?.id]);

  const toggleActive = async (ch: any) => {
    await (supabase as any).from("helpdesk_intake_channels").update({ is_active: !ch.is_active }).eq("id", ch.id);
    load();
  };

  const deleteChannel = async (id: string) => {
    if (!confirm("Delete this intake channel? This will revoke its public token.")) return;
    await (supabase as any).from("helpdesk_intake_channels").delete().eq("id", id);
    load();
  };

  const body = (
    <div className={embedded ? "space-y-6" : "container mx-auto py-6 space-y-6"}>
      <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Ticket Intake</h1>
            <p className="text-muted-foreground">Public channels for accepting tickets via web widgets and APIs</p>
          </div>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Channel</Button>
            </DialogTrigger>
            <CreateChannelDialog
              orgId={currentOrganization?.id}
              onClose={() => { setOpenCreate(false); load(); }}
            />
          </Dialog>
        </div>

        <Tabs defaultValue="channels">
          <TabsList>
            <TabsTrigger value="channels">Channels ({channels.length})</TabsTrigger>
            <TabsTrigger value="submissions">Recent Submissions</TabsTrigger>
            <TabsTrigger value="docs">Integration Docs</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="space-y-3">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : !channels.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                No channels yet. Create one to start accepting public ticket submissions.
              </CardContent></Card>
            ) : channels.map((ch) => (
              <Card key={ch.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {ch.channel_type === "widget" ? <Globe className="h-5 w-5 text-primary" /> :
                     ch.channel_type === "email" ? <Mail className="h-5 w-5 text-primary" /> :
                     <Code className="h-5 w-5 text-primary" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{ch.name}</h3>
                        <Badge variant={ch.is_active ? "default" : "secondary"}>{ch.is_active ? "Active" : "Disabled"}</Badge>
                        <Badge variant="outline" className="capitalize">{ch.channel_type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Token: <code>{ch.public_token.slice(0, 12)}…</code> · Limit: {ch.rate_limit_per_hour}/hr · Default priority: {ch.default_priority}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={ch.is_active} onCheckedChange={() => toggleActive(ch)} />
                    <Button size="sm" variant="outline" onClick={() => setSelected(ch)}>View Code</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteChannel(ch.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="submissions">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {submissions.map((s) => {
                      const ch = channels.find(c => c.id === s.channel_id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(s.created_at), "PPp")}</TableCell>
                          <TableCell>{ch?.name || "—"}</TableCell>
                          <TableCell className="max-w-xs truncate">{s.subject || "—"}</TableCell>
                          <TableCell className="text-xs">{s.submitter_email || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{s.ip_address || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={s.status === "success" ? "default" : s.status === "rate_limited" ? "secondary" : "destructive"}>
                              {s.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!submissions.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No submissions yet</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs">
            <Card>
              <CardHeader><CardTitle className="text-base">Public API Endpoint</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>Send a POST request with your channel token to create tickets from any web app or backend service.</p>
                <CodeBlock code={`POST ${INTAKE_URL}
Content-Type: application/json
x-channel-token: <your_channel_token>

{
  "subject": "Cannot log in",
  "description": "Getting 500 error on login page",
  "email": "user@example.com",
  "name": "Jane Doe",
  "priority": "high",
  "category": "Authentication"
}`} />
                <p className="text-xs text-muted-foreground">Required fields: <code>subject</code>. <code>email</code> required if channel enforces it. Returns <code>ticket_id</code> and <code>reference_number</code>.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {selected && <ChannelCodeDialog channel={selected} onClose={() => setSelected(null)} />}
      </div>
    </AppLayout>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">{code}</pre>
      <Button size="sm" variant="ghost" className="absolute top-1 right-1" onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied"); }}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function ChannelCodeDialog({ channel, onClose }: { channel: any; onClose: () => void }) {
  const widgetSnippet = `<!-- Embed support widget -->
<script>
  window.LOVABLE_HELPDESK_TOKEN = "${channel.public_token}";
  window.LOVABLE_HELPDESK_URL = "${INTAKE_URL}";
</script>
<script src="${window.location.origin}/intake-widget.js" defer></script>`;

  const apiSnippet = `fetch("${INTAKE_URL}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-channel-token": "${channel.public_token}"
  },
  body: JSON.stringify({
    subject: "Help needed",
    description: "Please describe the issue",
    email: "user@example.com",
    priority: "medium"
  })
});`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{channel.name} — Integration Code</DialogTitle></DialogHeader>
        <Tabs defaultValue="widget">
          <TabsList>
            <TabsTrigger value="widget">Web Widget</TabsTrigger>
            <TabsTrigger value="api">API (fetch)</TabsTrigger>
          </TabsList>
          <TabsContent value="widget"><CodeBlock code={widgetSnippet} /></TabsContent>
          <TabsContent value="api"><CodeBlock code={apiSnippet} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CreateChannelDialog({ orgId, onClose }: { orgId?: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("widget");
  const [priority, setPriority] = useState("medium");
  const [requireEmail, setRequireEmail] = useState(true);
  const [rateLimit, setRateLimit] = useState(30);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name || !orgId) return;
    setSaving(true);
    const { error } = await (supabase as any).from("helpdesk_intake_channels").insert({
      organization_id: orgId,
      name,
      channel_type: type,
      default_priority: priority,
      require_email: requireEmail,
      rate_limit_per_hour: rateLimit,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Channel created");
    onClose();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Intake Channel</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marketing site widget" /></div>
        <div><Label>Channel Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="widget">Web Widget</SelectItem>
              <SelectItem value="api">Public API</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Default Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["low","medium","high","urgent"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Rate limit (per hour, per IP)</Label><Input type="number" value={rateLimit} onChange={(e) => setRateLimit(+e.target.value)} /></div>
        <div className="flex items-center justify-between">
          <Label>Require email address</Label>
          <Switch checked={requireEmail} onCheckedChange={setRequireEmail} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={create} disabled={saving || !name}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button>
      </DialogFooter>
    </DialogContent>
  );
}

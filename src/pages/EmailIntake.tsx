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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Loader2, Mail, Trash2, Copy, Inbox, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/inbound-email`;

export default function EmailIntake({ embedded = false }: { embedded?: boolean } = {}) {
  const { currentOrganization } = useOrganization();
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);

  const load = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const [{ data: ib }, { data: msg }] = await Promise.all([
      (supabase as any).from("helpdesk_email_inboxes").select("*").eq("organization_id", currentOrganization.id).order("created_at", { ascending: false }),
      (supabase as any).from("helpdesk_email_messages").select("*, helpdesk_tickets(reference_number)").eq("organization_id", currentOrganization.id).order("received_at", { ascending: false }).limit(50),
    ]);
    setInboxes(ib || []);
    setMessages(msg || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentOrganization?.id]);

  const toggleActive = async (ib: any) => {
    await (supabase as any).from("helpdesk_email_inboxes").update({ is_active: !ib.is_active }).eq("id", ib.id);
    load();
  };

  const deleteInbox = async (id: string) => {
    if (!confirm("Delete this inbox? Existing messages will be kept but new emails to this address will be rejected.")) return;
    await (supabase as any).from("helpdesk_email_inboxes").delete().eq("id", id);
    load();
  };

  const body = (
    <div className={embedded ? "space-y-6" : "container mx-auto py-6 space-y-6"}>
      <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Email-to-Ticket</h1>
            <p className="text-muted-foreground">Convert inbound emails into tickets, with thread reply detection</p>
          </div>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Inbox</Button></DialogTrigger>
            <CreateInboxDialog orgId={currentOrganization?.id} onClose={() => { setOpenCreate(false); load(); }} />
          </Dialog>
        </div>

        <Tabs defaultValue="inboxes">
          <TabsList>
            <TabsTrigger value="inboxes">Inboxes ({inboxes.length})</TabsTrigger>
            <TabsTrigger value="messages">Recent Messages</TabsTrigger>
            <TabsTrigger value="setup">Provider Setup</TabsTrigger>
          </TabsList>

          <TabsContent value="inboxes" className="space-y-3">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : !inboxes.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                No inboxes yet. Add one (e.g. <code>support@yourcompany.com</code>) to start receiving tickets via email.
              </CardContent></Card>
            ) : inboxes.map((ib) => (
              <Card key={ib.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Mail className="h-5 w-5 text-primary" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{ib.email_address}</h3>
                        <Badge variant={ib.is_active ? "default" : "secondary"}>{ib.is_active ? "Active" : "Disabled"}</Badge>
                        {ib.auto_reply_enabled && <Badge variant="outline">Auto-reply on</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {ib.display_name || "—"} · Default priority: {ib.default_priority} · Spam filter: {ib.spam_filter_enabled ? "on" : "off"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={ib.is_active} onCheckedChange={() => toggleActive(ib)} />
                    <Button size="sm" variant="ghost" onClick={() => deleteInbox(ib.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Received</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Att.</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {messages.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(m.received_at), "PPp")}</TableCell>
                        <TableCell className="text-xs">{m.from_name || m.from_email}<br /><span className="text-muted-foreground">{m.from_email}</span></TableCell>
                        <TableCell className="text-xs">{m.to_email}</TableCell>
                        <TableCell className="max-w-xs truncate">{m.subject || "—"}</TableCell>
                        <TableCell>
                          {m.ticket_id ? (
                            <Link to={`/support/tickets/${m.ticket_id}`} className="text-primary hover:underline text-xs">
                              {m.helpdesk_tickets?.reference_number || "View"}
                            </Link>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            m.processing_status === "processed" ? "default" :
                            m.processing_status === "error" ? "destructive" :
                            "secondary"
                          }>{m.processing_status}</Badge>
                          {m.is_auto_reply && <Badge variant="outline" className="ml-1 text-xs">auto</Badge>}
                        </TableCell>
                        <TableCell className="text-xs">{Array.isArray(m.attachments) ? m.attachments.length : 0}</TableCell>
                      </TableRow>
                    ))}
                    {!messages.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No emails received yet</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="setup">
            <Card>
              <CardHeader><CardTitle className="text-base">Inbound Webhook URL</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
                  <code className="flex-1 text-xs break-all">{WEBHOOK_URL}</code>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success("Copied"); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs flex gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                  <div>
                    Configure your email provider (SendGrid Inbound Parse, Mailgun Routes, Postmark Inbound, CloudMailin, etc.) to POST parsed emails to this URL. Set the secret <code>INBOUND_EMAIL_SECRET</code> in your project secrets and pass it via <code>x-webhook-secret</code> header for authentication.
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Expected JSON payload</h4>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">{`{
  "from": "Jane <jane@example.com>",
  "to": "support@yourcompany.com",
  "subject": "Cannot login [T-ABC-123]",
  "text": "Plain text body...",
  "html": "<p>HTML body...</p>",
  "message_id": "<unique@mail.example.com>",
  "in_reply_to": "<original@mail.example.com>",
  "references": "<msg1@x.com> <msg2@x.com>",
  "headers": { "Auto-Submitted": "no" },
  "attachments": [
    { "filename": "screenshot.png", "content_type": "image/png", "content": "<base64>" }
  ]
}`}</pre>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><strong>Threading:</strong> Replies are matched by <code>In-Reply-To</code>, <code>References</code>, or a <code>[T-XXX-XXX]</code> marker in the subject. New emails create new tickets.</p>
                  <p><strong>Auto-replies:</strong> Detected via <code>Auto-Submitted</code> header or "Out of Office" subjects, and skipped when spam filter is enabled.</p>
                  <p><strong>Attachments:</strong> Stored in private bucket <code>helpdesk-email-attachments</code>; org members access via signed URLs.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
      </Tabs>
    </div>
  );

  return embedded ? body : <AppLayout title="Email-to-Ticket">{body}</AppLayout>;
}

function CreateInboxDialog({ orgId, onClose }: { orgId?: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("medium");
  const [autoReply, setAutoReply] = useState(true);
  const [autoReplySubject, setAutoReplySubject] = useState("We've received your request");
  const [autoReplyBody, setAutoReplyBody] = useState("Thanks for contacting support. We've created a ticket and will respond shortly.\n\nReference: {{ticket_reference}}");
  const [spam, setSpam] = useState(true);
  const [queueId, setQueueId] = useState<string>("");
  const [queues, setQueues] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (supabase as any).from("helpdesk_queues").select("id, name").eq("organization_id", orgId).eq("is_active", true).order("name").then(({ data }: any) => {
      setQueues(data || []);
    });
  }, [orgId]);

  const create = async () => {
    if (!email || !orgId) return;
    setSaving(true);
    const { error } = await (supabase as any).from("helpdesk_email_inboxes").insert({
      organization_id: orgId,
      email_address: email.toLowerCase().trim(),
      display_name: name || null,
      default_priority: priority,
      auto_reply_enabled: autoReply,
      auto_reply_subject: autoReplySubject,
      auto_reply_body: autoReplyBody,
      spam_filter_enabled: spam,
      queue_id: queueId || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Inbox created");
    onClose();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New Email Inbox</DialogTitle></DialogHeader>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        <div><Label>Email Address *</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@yourcompany.com" /></div>
        <div><Label>Display Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer Support" /></div>
        <div><Label>Default Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["low","medium","high","urgent"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Route to Queue (optional)</Label>
          <Select value={queueId || "__none"} onValueChange={(v) => setQueueId(v === "__none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="No queue (unassigned)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No queue (unassigned)</SelectItem>
              {queues.map((q) => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Tickets created from this inbox will be assigned to the queue and all members notified.{" "}
            <Link to="/support/queues" className="underline">Manage queues</Link>
          </p>
        </div>
        <div className="flex items-center justify-between"><Label>Auto-reply to sender</Label><Switch checked={autoReply} onCheckedChange={setAutoReply} /></div>
        {autoReply && <>
          <div><Label>Auto-reply Subject</Label><Input value={autoReplySubject} onChange={(e) => setAutoReplySubject(e.target.value)} /></div>
          <div><Label>Auto-reply Body</Label><Textarea value={autoReplyBody} onChange={(e) => setAutoReplyBody(e.target.value)} rows={4} /></div>
        </>}
        <div className="flex items-center justify-between"><Label>Filter auto-replies / out-of-office</Label><Switch checked={spam} onCheckedChange={setSpam} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={create} disabled={saving || !email}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Inbox</Button>
      </DialogFooter>
    </DialogContent>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { toast } from "sonner";
import { format } from "date-fns";
import { LifeBuoy, Plus, Send, ShieldAlert } from "lucide-react";

type Ticket = {
  id: string;
  organization_id: string | null;
  created_by: string;
  type: string;
  priority: string;
  status: string;
  subject: string;
  description: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  support: "Support",
  feature_request: "Feature Request",
  bug: "Bug",
  question: "Question",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  in_progress: "secondary",
  waiting_customer: "outline",
  resolved: "outline",
  closed: "outline",
};

const PRIORITY_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

export default function Support() {
  const { user, userRole } = useAuth();
  const { currentOrganization } = useOrganization();
  const { accessLevel, loading: accessLoading } = useOrgAccessLevel();
  const navigate = useNavigate();

  const isPlatformAdmin = userRole === "admin";
  const isOrgAdmin = accessLevel === "admin" || isPlatformAdmin;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [tab, setTab] = useState("open");

  // Form state
  const [form, setForm] = useState({
    subject: "",
    type: "support",
    priority: "medium",
    description: "",
  });

  const fetchTickets = async () => {
    setLoading(true);
    let query = supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!isPlatformAdmin && currentOrganization) {
      query = query.eq("organization_id", currentOrganization.id);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load tickets");
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isOrgAdmin) return;
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrgAdmin, currentOrganization?.id]);

  const openTicket = async (ticket: Ticket) => {
    setActiveTicket(ticket);
    const { data } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const handleCreate = async () => {
    if (!user || !form.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!currentOrganization && !isPlatformAdmin) {
      toast.error("No organization selected");
      return;
    }

    const { error } = await supabase.from("support_tickets").insert({
      created_by: user.id,
      organization_id: currentOrganization?.id ?? null,
      subject: form.subject,
      type: form.type,
      priority: form.priority,
      description: form.description,
    });

    if (error) {
      toast.error("Failed to create ticket: " + error.message);
      return;
    }

    toast.success("Ticket created");
    setForm({ subject: "", type: "support", priority: "medium", description: "" });
    setCreateOpen(false);
    fetchTickets();
  };

  const handleReply = async () => {
    if (!user || !activeTicket || !reply.trim()) return;
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: activeTicket.id,
      author_id: user.id,
      body: reply,
    });
    if (error) {
      toast.error("Failed to send reply");
      return;
    }
    setReply("");
    openTicket(activeTicket);
  };

  const updateStatus = async (status: string) => {
    if (!activeTicket) return;
    const updates: Record<string, unknown> = { status };
    if (status === "resolved" || status === "closed") {
      updates.resolved_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("support_tickets")
      .update(updates)
      .eq("id", activeTicket.id);
    if (error) {
      toast.error("Failed to update");
      return;
    }
    toast.success("Status updated");
    setActiveTicket({ ...activeTicket, ...updates } as Ticket);
    fetchTickets();
  };

  if (accessLoading) {
    return (
      <AppLayout title="Support">
        <div className="p-6 text-muted-foreground">Loading…</div>
      </AppLayout>
    );
  }

  if (!isOrgAdmin) {
    return (
      <AppLayout title="Support" subtitle="Get help and submit feature requests">
        <div className="p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-6 w-6 text-muted-foreground" />
                <CardTitle>Admins only</CardTitle>
              </div>
              <CardDescription>
                Submitting and tracking support requests is restricted to organization
                administrators. Please contact your org admin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate("/")}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const filtered = tickets.filter((t) => {
    if (tab === "open") return !["resolved", "closed"].includes(t.status);
    if (tab === "resolved") return ["resolved", "closed"].includes(t.status);
    return true;
  });

  return (
    <AppLayout title="Support" subtitle="Submit and track support requests, bugs, and feature ideas">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Your tickets</h2>
              <p className="text-sm text-muted-foreground">
                {isPlatformAdmin
                  ? "Viewing all organization tickets (platform admin)"
                  : `Tickets for ${currentOrganization?.name ?? "your organization"}`}
              </p>
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create support ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Brief summary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="feature_request">Feature Request</SelectItem>
                        <SelectItem value="bug">Bug Report</SelectItem>
                        <SelectItem value="question">Question</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    rows={6}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Provide details, steps to reproduce, or feature context"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Create Ticket</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 text-muted-foreground">Loading tickets…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    No tickets here yet. Click <strong>New Ticket</strong> to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((t) => (
                        <TableRow
                          key={t.id}
                          className="cursor-pointer"
                          onClick={() => openTicket(t)}
                        >
                          <TableCell className="font-medium">{t.subject}</TableCell>
                          <TableCell>{TYPE_LABELS[t.type] ?? t.type}</TableCell>
                          <TableCell>
                            <Badge variant={PRIORITY_VARIANTS[t.priority] ?? "outline"}>
                              {t.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[t.status] ?? "outline"}>
                              {t.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(t.updated_at), "PP")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Sheet open={!!activeTicket} onOpenChange={(open) => !open && setActiveTicket(null)}>
          <SheetContent className="sm:max-w-2xl flex flex-col">
            {activeTicket && (
              <>
                <SheetHeader>
                  <SheetTitle>{activeTicket.subject}</SheetTitle>
                  <SheetDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{TYPE_LABELS[activeTicket.type]}</Badge>
                      <Badge variant={PRIORITY_VARIANTS[activeTicket.priority]}>
                        {activeTicket.priority}
                      </Badge>
                      <Badge variant={STATUS_VARIANTS[activeTicket.status]}>
                        {activeTicket.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto space-y-4 my-4">
                  {activeTicket.description && (
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">
                          Opened {format(new Date(activeTicket.created_at), "PPp")}
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{activeTicket.description}</p>
                      </CardContent>
                    </Card>
                  )}
                  {messages.map((m) => (
                    <Card key={m.id} className={m.author_id === user?.id ? "bg-secondary" : ""}>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">
                          {format(new Date(m.created_at), "PPp")}
                          {m.is_internal && <Badge variant="outline" className="ml-2">Internal</Badge>}
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="space-y-3 border-t pt-4">
                  <Textarea
                    rows={3}
                    placeholder="Type a reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Select value={activeTicket.status} onValueChange={updateStatus}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting_customer">Waiting on customer</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleReply} disabled={!reply.trim()}>
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}

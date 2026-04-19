import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { LifeBuoy, Send, Search, UserCheck } from "lucide-react";

type Ticket = {
  id: string;
  organization_id: string | null;
  created_by: string;
  assigned_to: string | null;
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

type ProfileLite = { user_id: string; full_name: string | null; email: string };
type OrgLite = { id: string; name: string };

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

const TYPE_LABELS: Record<string, string> = {
  support: "Support",
  feature_request: "Feature Request",
  bug: "Bug",
  question: "Question",
};

export function PlatformSupportQueue() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [orgs, setOrgs] = useState<Record<string, OrgLite>>({});
  const [admins, setAdmins] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [internalReply, setInternalReply] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [ticketsRes, orgsRes, adminRolesRes] = await Promise.all([
      supabase.from("support_tickets").select("*").order("updated_at", { ascending: false }),
      supabase.from("organizations").select("id, name"),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);

    const ticketRows = (ticketsRes.data || []) as Ticket[];
    setTickets(ticketRows);

    const orgMap: Record<string, OrgLite> = {};
    (orgsRes.data || []).forEach((o: OrgLite) => (orgMap[o.id] = o));
    setOrgs(orgMap);

    const adminIds = (adminRolesRes.data || []).map((r: { user_id: string }) => r.user_id);

    // Fetch profiles for ticket creators, assignees, AND admins (for assignee dropdown)
    const userIds = Array.from(
      new Set(
        [
          ...ticketRows.flatMap((t) => [t.created_by, t.assigned_to]),
          ...adminIds,
        ].filter((v): v is string => !!v),
      ),
    );
    const profMap: Record<string, ProfileLite> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      (profs || []).forEach((p: ProfileLite) => (profMap[p.user_id] = p));
      setProfiles(profMap);
    }

    setAdmins(adminIds.map((id) => profMap[id]).filter(Boolean));

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openTicket = async (ticket: Ticket) => {
    setActiveTicket(ticket);
    setReply("");
    setInternalReply(false);
    const { data } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const sendReply = async () => {
    if (!user || !activeTicket || !reply.trim()) return;
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: activeTicket.id,
      author_id: user.id,
      body: reply,
      is_internal: internalReply,
    });
    if (error) {
      toast.error("Failed to send reply");
      return;
    }
    // Bump ticket updated_at + auto-set in_progress when staff replies publicly
    if (!internalReply && activeTicket.status === "open") {
      await supabase
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", activeTicket.id);
    }
    setReply("");
    setInternalReply(false);
    await openTicket(activeTicket);
    fetchAll();
  };

  const updateTicket = async (updates: Partial<Ticket>) => {
    if (!activeTicket) return;
    const patch: Record<string, unknown> = { ...updates };
    if (
      (updates.status === "resolved" || updates.status === "closed") &&
      !activeTicket.resolved_at
    ) {
      patch.resolved_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("support_tickets")
      .update(patch)
      .eq("id", activeTicket.id);
    if (error) {
      toast.error("Failed to update ticket");
      return;
    }
    toast.success("Ticket updated");
    setActiveTicket({ ...activeTicket, ...patch } as Ticket);
    fetchAll();
  };

  const counts = useMemo(() => {
    return {
      open: tickets.filter((t) => !["resolved", "closed"].includes(t.status)).length,
      mine: tickets.filter((t) => t.assigned_to === user?.id && !["resolved", "closed"].includes(t.status)).length,
      unassigned: tickets.filter((t) => !t.assigned_to && !["resolved", "closed"].includes(t.status)).length,
      resolved: tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length,
      all: tickets.length,
    };
  }, [tickets, user?.id]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (tab === "open" && ["resolved", "closed"].includes(t.status)) return false;
      if (tab === "mine" && (t.assigned_to !== user?.id || ["resolved", "closed"].includes(t.status))) return false;
      if (tab === "unassigned" && (t.assigned_to || ["resolved", "closed"].includes(t.status))) return false;
      if (tab === "resolved" && !["resolved", "closed"].includes(t.status)) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const orgName = (t.organization_id && orgs[t.organization_id]?.name) || "";
        const creator = profiles[t.created_by];
        const haystack = [
          t.subject,
          t.description ?? "",
          orgName,
          creator?.full_name ?? "",
          creator?.email ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, tab, typeFilter, priorityFilter, search, user?.id, orgs, profiles]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {[
          { label: "Open", value: counts.open },
          { label: "Assigned to me", value: counts.mine },
          { label: "Unassigned", value: counts.unassigned },
          { label: "Resolved", value: counts.resolved },
          { label: "Total", value: counts.all },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-2xl font-semibold">{loading ? "—" : c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <LifeBuoy className="h-5 w-5 text-primary" />
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by subject, org, or requester…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="feature_request">Feature Request</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="question">Question</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="open">Open ({counts.open})</TabsTrigger>
            <TabsTrigger value="mine">Mine ({counts.mine})</TabsTrigger>
            <TabsTrigger value="unassigned">Unassigned ({counts.unassigned})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({counts.resolved})</TabsTrigger>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading tickets…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No tickets match these filters.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const requester = profiles[t.created_by];
                  const assignee = t.assigned_to ? profiles[t.assigned_to] : null;
                  const org = t.organization_id ? orgs[t.organization_id] : null;
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => openTicket(t)}
                    >
                      <TableCell className="font-medium max-w-xs truncate">{t.subject}</TableCell>
                      <TableCell className="text-sm">{org?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {requester?.full_name || requester?.email || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{TYPE_LABELS[t.type] ?? t.type}</Badge>
                      </TableCell>
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
                      <TableCell className="text-sm">
                        {assignee ? (assignee.full_name || assignee.email) : (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(t.updated_at), "PP")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!activeTicket} onOpenChange={(open) => !open && setActiveTicket(null)}>
        <SheetContent className="sm:max-w-2xl flex flex-col">
          {activeTicket && (
            <>
              <SheetHeader>
                <SheetTitle>{activeTicket.subject}</SheetTitle>
                <SheetDescription asChild>
                  <div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{TYPE_LABELS[activeTicket.type]}</Badge>
                      <Badge variant={PRIORITY_VARIANTS[activeTicket.priority]}>
                        {activeTicket.priority}
                      </Badge>
                      <Badge variant={STATUS_VARIANTS[activeTicket.status]}>
                        {activeTicket.status.replace("_", " ")}
                      </Badge>
                      {activeTicket.organization_id && orgs[activeTicket.organization_id] && (
                        <Badge variant="secondary">{orgs[activeTicket.organization_id].name}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Requested by {profiles[activeTicket.created_by]?.full_name || profiles[activeTicket.created_by]?.email || "Unknown"}
                    </p>
                  </div>
                </SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="space-y-1">
                  <Label className="text-xs">Priority</Label>
                  <Select
                    value={activeTicket.priority}
                    onValueChange={(v) => updateTicket({ priority: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={activeTicket.status}
                    onValueChange={(v) => updateTicket({ status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="waiting_customer">Waiting on customer</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Assign to</Label>
                  <div className="flex gap-2">
                    <Select
                      value={activeTicket.assigned_to ?? "unassigned"}
                      onValueChange={(v) =>
                        updateTicket({ assigned_to: v === "unassigned" ? null : v })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {admins.map((a) => (
                          <SelectItem key={a.user_id} value={a.user_id}>
                            {a.full_name || a.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {user && activeTicket.assigned_to !== user.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateTicket({ assigned_to: user.id })}
                      >
                        <UserCheck className="h-4 w-4 mr-1" /> Claim
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 my-4">
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
                {messages.map((m) => {
                  const author = profiles[m.author_id];
                  const isStaff = m.author_id === user?.id;
                  return (
                    <Card
                      key={m.id}
                      className={
                        m.is_internal
                          ? "border-warning/50 bg-warning/5"
                          : isStaff
                          ? "bg-secondary"
                          : ""
                      }
                    >
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                          <span>{author?.full_name || author?.email || "User"}</span>
                          <span>·</span>
                          <span>{format(new Date(m.created_at), "PPp")}</span>
                          {m.is_internal && (
                            <Badge variant="outline" className="ml-1">Internal note</Badge>
                          )}
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="space-y-3 border-t pt-4">
                <Textarea
                  rows={3}
                  placeholder={internalReply ? "Internal note (not shown to customer)…" : "Reply to customer…"}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant={internalReply ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInternalReply(!internalReply)}
                  >
                    {internalReply ? "Internal note" : "Public reply"}
                  </Button>
                  <Button onClick={sendReply} disabled={!reply.trim()}>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

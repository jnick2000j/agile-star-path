import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, LifeBuoy, Mail, Filter, Headset, Sparkles, Inbox, Settings2, ChevronRight, ChevronDown, CornerDownRight } from "lucide-react";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { CreateTicketDialog } from "@/components/helpdesk/CreateTicketDialog";
import { HelpdeskCatalogManager } from "@/components/admin/HelpdeskCatalogManager";
import { HelpdeskBreadcrumbs } from "@/components/helpdesk/HelpdeskBreadcrumbs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn, formatLabel } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-info/10 text-info",
  open: "bg-primary/10 text-primary",
  pending: "bg-warning/10 text-warning",
  on_hold: "bg-muted text-muted-foreground",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-success/10 text-success",
};

const TYPE_LABELS: Record<string, string> = {
  support: "Support",
  incident: "Incident",
  service_request: "Service Request",
  question: "Question",
  problem: "Problem",
};

export default function Helpdesk() {
  const { currentOrganization } = useOrganization();
  const { accessLevel } = useOrgAccessLevel();
  const isAdmin = accessLevel === "admin";
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open_active");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [slaFilter, setSlaFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => setExpanded((s) => ({ ...s, [id]: !(s[id] ?? true) }));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropOnRoot, setDropOnRoot] = useState(false);

  const { data: tickets = [], refetch, isLoading } = useQuery({
    queryKey: ["helpdesk-tickets", currentOrganization?.id, statusFilter, typeFilter],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      let q = supabase
        .from("helpdesk_tickets")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (statusFilter === "open_active") {
        q = q.in("status", ["new", "open", "pending", "on_hold"] as any);
      } else if (statusFilter !== "all") {
        q = q.eq("status", statusFilter as any);
      }
      if (typeFilter !== "all") q = q.eq("ticket_type", typeFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  // Compute SLA state per ticket from existing fields
  const now = Date.now();
  const slaStateOf = (t: any): "paused" | "breached" | "at_risk" | "on_track" | "none" => {
    if (t.sla_breached || t.sla_response_breached || t.sla_resolution_breached) return "breached";
    if (t.sla_paused_at) return "paused";
    const due = t.sla_resolution_due_at ?? t.sla_response_due_at;
    if (!due) return "none";
    const dueMs = new Date(due).getTime();
    if (dueMs < now) return "breached";
    // At risk if within 25% of remaining window vs created window
    const created = t.created_at ? new Date(t.created_at).getTime() : now;
    const total = Math.max(1, dueMs - created);
    const remaining = dueMs - now;
    if (remaining / total <= 0.25) return "at_risk";
    return "on_track";
  };

  const filtered = tickets.filter((t: any) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !t.subject?.toLowerCase().includes(s) &&
        !t.reference_number?.toLowerCase().includes(s) &&
        !t.reporter_email?.toLowerCase().includes(s)
      ) return false;
    }
    if (slaFilter !== "all" && slaStateOf(t) !== slaFilter) return false;
    return true;
  });

  const stats = {
    open: tickets.filter((t: any) => ["new", "open", "pending"].includes(t.status)).length,
    urgent: tickets.filter((t: any) => t.priority === "urgent" && !["closed", "cancelled"].includes(t.status)).length,
    resolved: tickets.filter((t: any) => t.status === "resolved").length,
    total: tickets.length,
  };

  const SLA_BADGE: Record<string, { label: string; cls: string }> = {
    breached: { label: "Breached", cls: "bg-destructive text-destructive-foreground" },
    at_risk: { label: "At risk", cls: "bg-warning/20 text-warning" },
    paused: { label: "Paused", cls: "bg-muted text-muted-foreground" },
    on_track: { label: "On track", cls: "bg-success/10 text-success" },
    none: { label: "—", cls: "bg-transparent text-muted-foreground" },
  };

  // Build a parent/child tree from the filtered set.
  // Roots = tickets with no parent OR whose parent isn't in the visible filtered set.
  const filteredIds = new Set(filtered.map((t: any) => t.id));
  const childrenByParent: Record<string, any[]> = {};
  filtered.forEach((t: any) => {
    const p = t.parent_ticket_id;
    if (p && filteredIds.has(p)) (childrenByParent[p] ||= []).push(t);
  });
  const roots = filtered.filter(
    (t: any) => !t.parent_ticket_id || !filteredIds.has(t.parent_ticket_id),
  );

  type Row = { ticket: any; depth: number; hasChildren: boolean };
  const flattened: Row[] = [];
  const walk = (t: any, depth: number) => {
    const kids = childrenByParent[t.id] ?? [];
    flattened.push({ ticket: t, depth, hasChildren: kids.length > 0 });
    const isOpen = expanded[t.id] ?? true;
    if (isOpen && kids.length) kids.forEach((k) => walk(k, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));

  // Collect all descendant ids of a ticket (within the full tickets set, not just filtered)
  // so we can prevent dropping a ticket onto itself or one of its descendants.
  const descendantsOf = (rootId: string): Set<string> => {
    const result = new Set<string>();
    const allChildrenByParent: Record<string, any[]> = {};
    tickets.forEach((t: any) => {
      if (t.parent_ticket_id) (allChildrenByParent[t.parent_ticket_id] ||= []).push(t);
    });
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop()!;
      const kids = allChildrenByParent[id] ?? [];
      for (const k of kids) {
        if (!result.has(k.id)) {
          result.add(k.id);
          stack.push(k.id);
        }
      }
    }
    return result;
  };

  const reparent = async (childId: string, newParentId: string | null) => {
    const child = tickets.find((t: any) => t.id === childId);
    if (!child) return;
    if (child.parent_ticket_id === newParentId) return;
    if (newParentId === childId) {
      toast.error("A ticket can't be its own parent");
      return;
    }
    if (newParentId && descendantsOf(childId).has(newParentId)) {
      toast.error("Can't move a ticket under one of its own sub-tickets");
      return;
    }
    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ parent_ticket_id: newParentId })
      .eq("id", childId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(newParentId ? "Moved under new parent" : "Moved to top level");
    if (newParentId) setExpanded((s) => ({ ...s, [newParentId]: true }));
    refetch();
  };

  return (
    <AppLayout title="Helpdesk" subtitle="Ticket-based support and service requests">
      <FeatureGate
        feature="feature_helpdesk"
        title="Helpdesk & Support"
        description="Premium module: ticket portal, email intake, SLA tracking, and links to projects, programmes, and products."
      >
        <div className="space-y-6">
          <HelpdeskBreadcrumbs />
          <ViewSwitcher
            current="console"
            tabs={[
              { key: "console", label: "Agent console", to: "/support", icon: Headset },
              { key: "portal", label: "Get support (AI)", to: "/support/portal", icon: Sparkles },
              { key: "mine", label: "My tickets", to: "/support/my-tickets", icon: Inbox },
            ]}
          />
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Open" value={stats.open} icon={<LifeBuoy className="h-4 w-4" />} />
            <StatCard label="Urgent" value={stats.urgent} accent="destructive" />
            <StatCard label="Resolved" value={stats.resolved} accent="success" />
            <StatCard label="Total" value={stats.total} />
          </div>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets, reference, reporter..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open_active">Active (open)</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="service_request">Service Request</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="problem">Problem</SelectItem>
                </SelectContent>
              </Select>
              <Select value={slaFilter} onValueChange={setSlaFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="SLA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All SLA states</SelectItem>
                  <SelectItem value="breached">Breached</SelectItem>
                  <SelectItem value="at_risk">At risk</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="on_track">On track</SelectItem>
                  <SelectItem value="none">No SLA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={() => setCatalogOpen(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Manage Catalog
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate("/support/portal")}>
                <Mail className="h-4 w-4 mr-2" />
                Open Portal
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No tickets found</TableCell></TableRow>
                ) : flattened.map(({ ticket: t, depth, hasChildren }) => {
                  const sla = slaStateOf(t);
                  const slaCfg = SLA_BADGE[sla];
                  const isOpen = expanded[t.id] ?? true;
                  return (
                    <TableRow
                      key={t.id}
                      className={cn("cursor-pointer", depth > 0 && "bg-muted/20")}
                      onClick={() => navigate(`/support/tickets/${t.id}`)}
                    >
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 18 }}>
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
                              className="p-0.5 rounded hover:bg-muted"
                              aria-label={isOpen ? "Collapse sub-tickets" : "Expand sub-tickets"}
                            >
                              {isOpen
                                ? <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          ) : depth > 0 ? (
                            <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <span className="inline-block w-[18px]" />
                          )}
                          <span>{t.reference_number ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{t.subject}</span>
                          {hasChildren && (
                            <Badge variant="outline" className="text-[10px]">
                              {(childrenByParent[t.id] ?? []).length} sub
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{TYPE_LABELS[t.ticket_type] ?? formatLabel(t.ticket_type)}</Badge></TableCell>
                      <TableCell><Badge className={cn(PRIORITY_STYLES[t.priority])}>{formatLabel(t.priority)}</Badge></TableCell>
                      <TableCell><Badge className={cn(STATUS_STYLES[t.status])}>{formatLabel(t.status)}</Badge></TableCell>
                      <TableCell>
                        {sla === "none" ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Badge className={cn("text-xs", slaCfg.cls)}>{slaCfg.label}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{t.reporter_name || t.reporter_email || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.created_at ? format(new Date(t.created_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <CreateTicketDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => refetch()}
        />

        {isAdmin && (
          <Sheet open={catalogOpen} onOpenChange={setCatalogOpen}>
            <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Helpdesk Catalog</SheetTitle>
                <SheetDescription>
                  Define custom lists like Services, Applications, Departments, or Locations that agents can attach to tickets in addition to the ticket type.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <HelpdeskCatalogManager />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </FeatureGate>
    </AppLayout>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon?: React.ReactNode; accent?: "destructive" | "success" }) {
  return (
    <div className="border rounded-lg bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={cn(
        "text-2xl font-semibold mt-1",
        accent === "destructive" && "text-destructive",
        accent === "success" && "text-success",
      )}>{value}</p>
    </div>
  );
}

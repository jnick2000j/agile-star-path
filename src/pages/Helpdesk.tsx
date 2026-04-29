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
import { Search, Plus, LifeBuoy, Mail, Filter, Headset, Sparkles, Inbox, Settings2, ChevronRight, ChevronDown, CornerDownRight, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { BulkParentDialog } from "@/components/helpdesk/BulkParentDialog";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkParentOpen, setBulkParentOpen] = useState(false);
  const toggleSelected = (id: string) =>
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // Bulk reparent: validate each id (no self/descendant cycles), then update in one query.
  const bulkReparent = async (newParentId: string | null) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const invalid: string[] = [];
    if (newParentId) {
      const blockedDescendants = descendantsOf(newParentId);
      for (const id of ids) {
        if (id === newParentId) { invalid.push(id); continue; }
        if (blockedDescendants.has(id)) { invalid.push(id); continue; }
      }
    }
    const validIds = ids.filter((id) => !invalid.includes(id));
    if (!validIds.length) {
      toast.error("None of the selected tickets can be moved under that parent");
      return;
    }
    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ parent_ticket_id: newParentId })
      .in("id", validIds);
    if (error) {
      toast.error(error.message);
      return;
    }
    const skipped = invalid.length;
    toast.success(
      `Moved ${validIds.length} ticket${validIds.length === 1 ? "" : "s"}` +
        (newParentId ? " under new parent" : " to top level") +
        (skipped ? ` (${skipped} skipped to avoid a cycle)` : ""),
    );
    if (newParentId) setExpanded((s) => ({ ...s, [newParentId]: true }));
    clearSelection();
    refetch();
  };

  // Delete tickets. Children of deleted tickets are reparented to the deleted
  // ticket's own parent (or to top-level) so they remain visible.
  const performDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const ids = deleteTarget.ids;
      // Reparent children of each deleted ticket to that ticket's parent.
      const parentMap = new Map<string, string | null>();
      tickets.forEach((t: any) => parentMap.set(t.id, t.parent_ticket_id ?? null));
      const reparentOps: Promise<any>[] = [];
      const grouped = new Map<string | null, string[]>();
      tickets.forEach((t: any) => {
        if (t.parent_ticket_id && ids.includes(t.parent_ticket_id) && !ids.includes(t.id)) {
          // walk up until we find an ancestor not being deleted (or null)
          let anc: string | null = parentMap.get(t.parent_ticket_id) ?? null;
          while (anc && ids.includes(anc)) anc = parentMap.get(anc) ?? null;
          const list = grouped.get(anc) ?? [];
          list.push(t.id);
          grouped.set(anc, list);
        }
      });
      grouped.forEach((childIds, newParent) => {
        reparentOps.push(
          supabase
            .from("helpdesk_tickets")
            .update({ parent_ticket_id: newParent })
            .in("id", childIds)
            .then((r) => r),
        );
      });
      if (reparentOps.length) await Promise.all(reparentOps);

      const { error } = await supabase
        .from("helpdesk_tickets")
        .delete()
        .in("id", ids);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(
        ids.length === 1 ? "Ticket deleted" : `${ids.length} tickets deleted`,
      );
      clearSelection();
      setDeleteTarget(null);
      refetch();
    } finally {
      setDeleting(false);
    }
  };
  const visibleIds = filtered.map((t: any) => t.id) as string[];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    setSelectedIds((s) => {
      if (allVisibleSelected) {
        const next = new Set(s);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(s);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
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
          {dragId && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropOnRoot(true);
              }}
              onDragLeave={() => setDropOnRoot(false)}
              onDrop={(e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData("text/plain") || dragId;
                setDropOnRoot(false);
                setDragId(null);
                if (draggedId) reparent(draggedId, null);
              }}
              className={cn(
                "border-2 border-dashed rounded-lg px-4 py-3 text-sm text-center transition-colors",
                dropOnRoot
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              Drop here to move ticket to the top level
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border rounded-lg bg-primary/5 px-3 py-2">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Bulk actions apply to all selected tickets
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => bulkReparent(null)}>
                  Move to top level
                </Button>
                <Button size="sm" onClick={() => setBulkParentOpen(true)}>
                  Set parent...
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all visible tickets"
                    />
                  </TableHead>
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
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No tickets found</TableCell></TableRow>
                ) : flattened.map(({ ticket: t, depth, hasChildren }) => {
                  const sla = slaStateOf(t);
                  const slaCfg = SLA_BADGE[sla];
                  const isOpen = expanded[t.id] ?? true;
                  const isDragging = dragId === t.id;
                  const isDropTarget = dropTargetId === t.id && dragId && dragId !== t.id;
                  return (
                    <TableRow
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", t.id);
                        setDragId(t.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropTargetId(null);
                      }}
                      onDragOver={(e) => {
                        if (!dragId || dragId === t.id) return;
                        // Block dropping onto own descendant
                        if (descendantsOf(dragId).has(t.id)) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dropTargetId !== t.id) setDropTargetId(t.id);
                      }}
                      onDragLeave={() => {
                        if (dropTargetId === t.id) setDropTargetId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const draggedId = e.dataTransfer.getData("text/plain") || dragId;
                        setDropTargetId(null);
                        setDragId(null);
                        if (draggedId && draggedId !== t.id) reparent(draggedId, t.id);
                      }}
                      className={cn(
                        "cursor-pointer transition-colors",
                        depth > 0 && "bg-muted/20",
                        isDragging && "opacity-40",
                        isDropTarget && "ring-2 ring-inset ring-primary bg-primary/5",
                      )}
                      onClick={() => navigate(`/support/tickets/${t.id}`)}
                    >
                      <TableCell
                        className="w-[40px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedIds.has(t.id)}
                          onCheckedChange={() => toggleSelected(t.id)}
                          aria-label={`Select ticket ${t.reference_number ?? t.id}`}
                        />
                      </TableCell>
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

        <BulkParentDialog
          open={bulkParentOpen}
          onOpenChange={setBulkParentOpen}
          selectedIds={Array.from(selectedIds)}
          onConfirm={(parentId) => bulkReparent(parentId)}
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

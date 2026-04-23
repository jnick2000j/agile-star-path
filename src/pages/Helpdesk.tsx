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
import { Search, Plus, LifeBuoy, Mail, Filter, Headset, Sparkles, Inbox } from "lucide-react";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { CreateTicketDialog } from "@/components/helpdesk/CreateTicketDialog";
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
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: tickets = [], refetch, isLoading } = useQuery({
    queryKey: ["helpdesk-tickets", currentOrganization?.id, statusFilter, typeFilter],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      let q = supabase
        .from("helpdesk_tickets")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      if (typeFilter !== "all") q = q.eq("ticket_type", typeFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const filtered = tickets.filter((t: any) =>
    !search ||
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.reference_number?.toLowerCase().includes(search.toLowerCase()) ||
    t.reporter_email?.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    open: tickets.filter((t: any) => ["new", "open", "pending"].includes(t.status)).length,
    urgent: tickets.filter((t: any) => t.priority === "urgent" && t.status !== "closed").length,
    resolved: tickets.filter((t: any) => t.status === "resolved").length,
    total: tickets.length,
  };

  return (
    <AppLayout title="Helpdesk" subtitle="Ticket-based support and service requests">
      <FeatureGate
        feature="feature_helpdesk"
        title="Helpdesk & Support"
        description="Premium module: ticket portal, email intake, SLA tracking, and links to projects, programmes, and products."
      >
        <div className="space-y-6">
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
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
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
            </div>
            <div className="flex gap-2">
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
                  <TableHead>Reporter</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No tickets found</TableCell></TableRow>
                ) : filtered.map((t: any) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/support/tickets/${t.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{t.reference_number ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.subject}</TableCell>
                    <TableCell><Badge variant="outline">{TYPE_LABELS[t.ticket_type] ?? formatLabel(t.ticket_type)}</Badge></TableCell>
                    <TableCell><Badge className={cn(PRIORITY_STYLES[t.priority])}>{formatLabel(t.priority)}</Badge></TableCell>
                    <TableCell><Badge className={cn(STATUS_STYLES[t.status])}>{formatLabel(t.status)}</Badge></TableCell>
                    <TableCell className="text-sm">{t.reporter_name || t.reporter_email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.created_at ? format(new Date(t.created_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <CreateTicketDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => refetch()}
        />
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

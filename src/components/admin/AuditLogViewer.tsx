import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Activity,
  Search,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
  Settings,
  Trash2,
  Download,
  Key,
  AlertTriangle,
} from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

interface AuditLog {
  id: string;
  event_type: string;
  event_category: string;
  user_id: string | null;
  user_email: string | null;
  organization_id: string | null;
  target_user_id: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  metadata: any;
  created_at: string;
}

const categoryIcons: Record<string, any> = {
  auth: LogIn,
  sso: ShieldCheck,
  user_management: UserPlus,
  settings: Settings,
  data: Download,
  security: Key,
};

const eventLabels: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  sso_login: "SSO Login",
  failed_login: "Failed Login",
  signup: "Sign Up",
  password_change: "Password Changed",
  password_reset: "Password Reset",
  invite_sent: "Invite Sent",
  invite_accepted: "Invite Accepted",
  role_changed: "Role Changed",
  access_granted: "Access Granted",
  access_revoked: "Access Revoked",
  user_archived: "User Archived",
  data_export: "Data Exported",
  settings_changed: "Settings Changed",
  entity_deleted: "Entity Deleted",
  sso_config_requested: "SSO Config Requested",
  sso_config_approved: "SSO Config Approved",
  sso_config_rejected: "SSO Config Rejected",
};

export function AuditLogViewer({ scope = "org" }: { scope?: "org" | "platform" }) {
  const { currentOrganization } = useOrganization();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchLogs();
  }, [currentOrganization?.id, scope]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("auth_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (scope === "org" && currentOrganization?.id) {
        query = query.eq("organization_id", currentOrganization.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error("Audit log fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter((log) => {
    if (categoryFilter !== "all" && log.event_category !== categoryFilter) return false;
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        log.event_type.toLowerCase().includes(s) ||
        log.user_email?.toLowerCase().includes(s) ||
        log.target_entity_type?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      success: "bg-success/10 text-success border-success/20",
      failure: "bg-destructive/10 text-destructive border-destructive/20",
      pending: "bg-warning/10 text-warning border-warning/20",
    };
    return (
      <Badge variant="outline" className={`capitalize text-xs ${map[status] || ""}`}>
        {status}
      </Badge>
    );
  };

  const categoryBadge = (category: string) => {
    const Icon = categoryIcons[category] || Activity;
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="capitalize">{category.replace("_", " ")}</span>
      </div>
    );
  };

  const exportCsv = () => {
    const headers = ["Timestamp", "Event", "Category", "User", "Status", "Target", "Metadata"];
    const rows = filtered.map((l) => [
      format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss"),
      eventLabels[l.event_type] || l.event_type,
      l.event_category,
      l.user_email || "—",
      l.status,
      l.target_entity_type ? `${l.target_entity_type}:${l.target_entity_id}` : "—",
      JSON.stringify(l.metadata || {}),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Audit Log</h2>
            <p className="text-sm text-muted-foreground">
              {scope === "platform"
                ? "All platform-wide audit events"
                : "Authentication, access, and data events for your organization"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events, users, entities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="auth">Authentication</SelectItem>
            <SelectItem value="sso">SSO</SelectItem>
            <SelectItem value="user_management">User Management</SelectItem>
            <SelectItem value="settings">Settings</SelectItem>
            <SelectItem value="data">Data Events</SelectItem>
            <SelectItem value="security">Security</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {logs.length === 0
            ? "No audit events recorded yet."
            : "No events match your filters."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-sm">
                        {eventLabels[log.event_type] || log.event_type}
                      </div>
                      {categoryBadge(log.event_category)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.user_email || (
                      <span className="text-muted-foreground italic">System</span>
                    )}
                  </TableCell>
                  <TableCell>{statusBadge(log.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[240px]">
                    {log.target_entity_type && (
                      <div className="capitalize">
                        {log.target_entity_type.replace("_", " ")}
                      </div>
                    )}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="truncate font-mono text-[10px]">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                    {log.ip_address && <div>IP: {log.ip_address}</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-3 text-right">
        Showing {filtered.length} of {logs.length} events (last 500)
      </div>
    </Card>
  );
}

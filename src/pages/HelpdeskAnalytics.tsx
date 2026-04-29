import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ticket, Clock, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Users, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval, parseISO, differenceInMinutes } from "date-fns";

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "hsl(var(--destructive))",
  high: "hsl(var(--warning))",
  medium: "hsl(var(--primary))",
  low: "hsl(var(--muted-foreground))",
};

function fmtMinutes(min: number) {
  if (!min || isNaN(min)) return "—";
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 1440) return `${(min / 60).toFixed(1)}h`;
  return `${(min / 1440).toFixed(1)}d`;
}

export default function HelpdeskAnalytics() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [range, setRange] = useState("30");
  const days = Number(range);
  const startDate = useMemo(() => startOfDay(subDays(new Date(), days)), [days]);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["analytics-tickets", orgId, days],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("id, status, priority, ticket_type, category, source, created_at, first_response_at, resolved_at, closed_at, sla_response_due_at, sla_resolution_due_at, sla_response_breached, sla_resolution_breached, assignee_id")
        .eq("organization_id", orgId)
        .gte("created_at", startDate.toISOString())
        .limit(5000);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: deflections = [] } = useQuery({
    queryKey: ["analytics-deflections", orgId, days],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("kb_ticket_deflections")
        .select("id, resolved_without_ticket, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", startDate.toISOString());
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["analytics-agents", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("organization_members")
        .select("user_id, profiles:user_id(first_name, last_name)")
        .eq("organization_id", orgId);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, string>();
    agents.forEach((a: any) => {
      const p = a.profiles;
      if (p) m.set(a.user_id, `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unnamed");
    });
    return m;
  }, [agents]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const resolved = tickets.filter((t: any) => t.resolved_at || t.closed_at).length;
    const open = total - resolved;
    const responded = tickets.filter((t: any) => t.first_response_at);
    const responseTimes = responded.map((t: any) => differenceInMinutes(parseISO(t.first_response_at), parseISO(t.created_at)));
    const avgResponse = responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    const resolvedTickets = tickets.filter((t: any) => t.resolved_at);
    const resolutionTimes = resolvedTickets.map((t: any) => differenceInMinutes(parseISO(t.resolved_at), parseISO(t.created_at)));
    const mttr = resolutionTimes.length ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : 0;
    const slaTotal = tickets.filter((t: any) => t.sla_resolution_due_at).length;
    const slaBreached = tickets.filter((t: any) => t.sla_resolution_breached).length;
    const slaCompliance = slaTotal ? ((slaTotal - slaBreached) / slaTotal) * 100 : 100;
    const totalDeflections = deflections.length;
    const successfulDeflections = deflections.filter((d: any) => d.resolved_without_ticket).length;
    const deflectionRate = totalDeflections ? (successfulDeflections / totalDeflections) * 100 : 0;
    return { total, resolved, open, avgResponse, mttr, slaCompliance, slaBreached, deflectionRate, successfulDeflections };
  }, [tickets, deflections]);

  const volumeTrend = useMemo(() => {
    const buckets = eachDayOfInterval({ start: startDate, end: new Date() });
    return buckets.map((d) => {
      const dayStr = format(d, "yyyy-MM-dd");
      const created = tickets.filter((t: any) => format(parseISO(t.created_at), "yyyy-MM-dd") === dayStr).length;
      const resolved = tickets.filter((t: any) => t.resolved_at && format(parseISO(t.resolved_at), "yyyy-MM-dd") === dayStr).length;
      return { date: format(d, "MMM d"), created, resolved };
    });
  }, [tickets, startDate]);

  const priorityBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach((t: any) => { counts[t.priority || "medium"] = (counts[t.priority || "medium"] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach((t: any) => { counts[t.category || "uncategorized"] = (counts[t.category || "uncategorized"] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [tickets]);

  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach((t: any) => { counts[t.source || "manual"] = (counts[t.source || "manual"] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const agentPerformance = useMemo(() => {
    const map = new Map<string, { assigned: number; resolved: number; responseTimes: number[]; resolutionTimes: number[]; breaches: number }>();
    tickets.forEach((t: any) => {
      if (!t.assignee_id) return;
      if (!map.has(t.assignee_id)) map.set(t.assignee_id, { assigned: 0, resolved: 0, responseTimes: [], resolutionTimes: [], breaches: 0 });
      const a = map.get(t.assignee_id)!;
      a.assigned++;
      if (t.resolved_at) {
        a.resolved++;
        a.resolutionTimes.push(differenceInMinutes(parseISO(t.resolved_at), parseISO(t.created_at)));
      }
      if (t.first_response_at) a.responseTimes.push(differenceInMinutes(parseISO(t.first_response_at), parseISO(t.created_at)));
      if (t.sla_resolution_breached) a.breaches++;
    });
    return Array.from(map.entries()).map(([id, m]) => ({
      id,
      name: agentMap.get(id) || "Unknown",
      assigned: m.assigned,
      resolved: m.resolved,
      resolutionRate: m.assigned ? (m.resolved / m.assigned) * 100 : 0,
      avgResponse: m.responseTimes.length ? m.responseTimes.reduce((a, b) => a + b, 0) / m.responseTimes.length : 0,
      avgResolution: m.resolutionTimes.length ? m.resolutionTimes.reduce((a, b) => a + b, 0) / m.resolutionTimes.length : 0,
      breaches: m.breaches,
    })).sort((a, b) => b.assigned - a.assigned);
  }, [tickets, agentMap]);

  return (
    <AppLayout title="Helpdesk Analytics">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Helpdesk Analytics</h1>
            <p className="text-sm text-muted-foreground">Performance, SLA compliance, and trend insights</p>
          </div>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3"><Ticket className="h-8 w-8 text-primary" /><div>
              <p className="text-sm text-muted-foreground">Total Tickets</p>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{stats.open} open · {stats.resolved} resolved</p>
            </div></div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3"><Clock className="h-8 w-8 text-warning" /><div>
              <p className="text-sm text-muted-foreground">Avg First Response</p>
              <p className="text-2xl font-bold">{fmtMinutes(stats.avgResponse)}</p>
            </div></div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-success" /><div>
              <p className="text-sm text-muted-foreground">MTTR</p>
              <p className="text-2xl font-bold">{fmtMinutes(stats.mttr)}</p>
            </div></div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3"><Target className="h-8 w-8 text-primary" /><div>
              <p className="text-sm text-muted-foreground">SLA Compliance</p>
              <p className="text-2xl font-bold">{stats.slaCompliance.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">{stats.slaBreached} breaches</p>
            </div></div>
          </Card>
        </div>

        <Tabs defaultValue="trends">
          <TabsList>
            <TabsTrigger value="trends">Volume Trends</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
            <TabsTrigger value="agents">Agent Performance</TabsTrigger>
            <TabsTrigger value="deflection">KB Deflection</TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="mt-4 space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Tickets Created vs Resolved</h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={volumeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="created" stroke="hsl(var(--primary))" strokeWidth={2} name="Created" />
                  <Line type="monotone" dataKey="resolved" stroke="hsl(var(--success))" strokeWidth={2} name="Resolved" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          <TabsContent value="breakdown" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">By Priority</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={priorityBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {priorityBreakdown.map((entry, i) => (
                        <Cell key={i} fill={PRIORITY_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Top Categories</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={categoryBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={90} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-4">By Source</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={sourceBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {sourceBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="mt-4">
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Resolved</TableHead>
                  <TableHead className="text-right">Resolution Rate</TableHead>
                  <TableHead className="text-right">Avg Response</TableHead>
                  <TableHead className="text-right">Avg Resolution</TableHead>
                  <TableHead className="text-right">SLA Breaches</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {agentPerformance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-right">{a.assigned}</TableCell>
                      <TableCell className="text-right">{a.resolved}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={a.resolutionRate >= 80 ? "bg-success/10 text-success" : a.resolutionRate >= 50 ? "bg-warning/20 text-warning" : "bg-destructive/10 text-destructive"}>
                          {a.resolutionRate.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtMinutes(a.avgResponse)}</TableCell>
                      <TableCell className="text-right">{fmtMinutes(a.avgResolution)}</TableCell>
                      <TableCell className="text-right">
                        {a.breaches > 0 ? <Badge className="bg-destructive/10 text-destructive">{a.breaches}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {agentPerformance.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No assigned tickets in this period</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="deflection" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card className="p-4">
                <div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-success" /><div>
                  <p className="text-sm text-muted-foreground">Deflection Rate</p>
                  <p className="text-2xl font-bold">{stats.deflectionRate.toFixed(1)}%</p>
                </div></div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-primary" /><div>
                  <p className="text-sm text-muted-foreground">Tickets Avoided</p>
                  <p className="text-2xl font-bold">{stats.successfulDeflections}</p>
                </div></div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3"><Users className="h-8 w-8 text-muted-foreground" /><div>
                  <p className="text-sm text-muted-foreground">KB Article Views (in flow)</p>
                  <p className="text-2xl font-bold">{deflections.length}</p>
                </div></div>
              </Card>
            </div>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">
                The deflection rate measures how often customers resolved their question via a knowledge base article during the ticket submission flow,
                without proceeding to file a ticket. Higher rates indicate more effective self-service content.
              </p>
            </Card>
          </TabsContent>
        </Tabs>

        {isLoading && <p className="text-sm text-muted-foreground text-center">Loading…</p>}
      </div>
    </AppLayout>
  );
}

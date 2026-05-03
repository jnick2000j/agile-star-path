import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { format } from "date-fns";

interface EnrollmentRow {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  progress_percent: number;
  final_score: number | null;
  mandatory: boolean;
  source: string;
  enrolled_at: string;
  started_at: string | null;
  completed_at: string | null;
  due_at: string | null;
  course_title?: string;
  user_name?: string;
  user_email?: string;
}

const STATUSES = ["all", "not_started", "in_progress", "completed", "overdue"] as const;

function toCsv(rows: EnrollmentRow[]): string {
  const headers = [
    "Enrollment ID","User","Email","Course","Status","Progress %","Score","Mandatory",
    "Source","Enrolled","Started","Completed","Due",
  ];
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.id, r.user_name ?? r.user_id, r.user_email ?? "", r.course_title ?? r.course_id,
      r.status, r.progress_percent, r.final_score ?? "", r.mandatory ? "Yes" : "No",
      r.source, r.enrolled_at, r.started_at ?? "", r.completed_at ?? "", r.due_at ?? "",
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function LmsAdminDashboard() {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);

  const [status, setStatus] = useState<string>("all");
  const [courseId, setCourseId] = useState<string>("all");
  const [mandatoryOnly, setMandatoryOnly] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const reload = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const orgId = currentOrganization.id;
    const [eRes, cRes, pRes] = await Promise.all([
      supabase.from("lms_enrollments").select("*").eq("organization_id", orgId).order("enrolled_at", { ascending: false }).limit(1000),
      supabase.from("lms_courses").select("id,title").eq("organization_id", orgId),
      supabase.from("profiles").select("user_id,first_name,last_name,email").eq("organization_id", orgId),
    ]);
    if (eRes.error) { toast.error(eRes.error.message); setLoading(false); return; }
    const courseMap = new Map((cRes.data ?? []).map((c: any) => [c.id, c.title]));
    const profMap = new Map((pRes.data ?? []).map((p: any) => [
      p.user_id,
      { name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || p.user_id, email: p.email ?? "" },
    ]));
    const enriched: EnrollmentRow[] = (eRes.data ?? []).map((e: any) => ({
      ...e,
      course_title: courseMap.get(e.course_id),
      user_name: profMap.get(e.user_id)?.name,
      user_email: profMap.get(e.user_id)?.email,
    }));
    setRows(enriched);
    setCourses((cRes.data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [currentOrganization?.id]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      if (courseId !== "all" && r.course_id !== courseId) return false;
      if (mandatoryOnly === "yes" && !r.mandatory) return false;
      if (mandatoryOnly === "no" && r.mandatory) return false;
      if (status !== "all") {
        if (status === "overdue") {
          if (!r.due_at || r.status === "completed" || new Date(r.due_at).getTime() >= now) return false;
        } else if (r.status !== status) return false;
      }
      if (from && new Date(r.enrolled_at) < new Date(from)) return false;
      if (to && new Date(r.enrolled_at) > new Date(to + "T23:59:59")) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(r.user_name?.toLowerCase().includes(q) ||
              r.user_email?.toLowerCase().includes(q) ||
              r.course_title?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [rows, status, courseId, mandatoryOnly, search, from, to]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter((r) => r.status === "completed").length;
    const inProgress = filtered.filter((r) => r.status === "in_progress").length;
    const notStarted = filtered.filter((r) => r.status === "not_started").length;
    const now = Date.now();
    const overdue = filtered.filter((r) => r.due_at && r.status !== "completed" && new Date(r.due_at).getTime() < now).length;
    const compliance = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgProgress = total > 0 ? Math.round(filtered.reduce((s, r) => s + (r.progress_percent || 0), 0) / total) : 0;
    return { total, completed, inProgress, notStarted, overdue, compliance, avgProgress };
  }, [filtered]);

  const exportCsv = () => {
    if (filtered.length === 0) return toast.info("No rows to export");
    downloadCsv(`lms-enrollments-${format(new Date(), "yyyyMMdd-HHmm")}.csv`, toCsv(filtered));
    toast.success(`Exported ${filtered.length} rows`);
  };

  const statusBadge = (s: string, due: string | null) => {
    const overdue = due && s !== "completed" && new Date(due).getTime() < Date.now();
    if (overdue) return <Badge variant="destructive">Overdue</Badge>;
    if (s === "completed") return <Badge>Completed</Badge>;
    if (s === "in_progress") return <Badge variant="secondary">In progress</Badge>;
    return <Badge variant="outline">Not started</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Enrollments", value: stats.total },
          { label: "Completed", value: stats.completed },
          { label: "In progress", value: stats.inProgress },
          { label: "Not started", value: stats.notStarted },
          { label: "Overdue", value: stats.overdue },
          { label: "Compliance", value: `${stats.compliance}%` },
          { label: "Avg progress", value: `${stats.avgProgress}%` },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="text-2xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <Label className="text-xs">Search</Label>
            <Input placeholder="User, email, course…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All" : s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mandatory</Label>
            <Select value={mandatoryOnly} onValueChange={setMandatoryOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Mandatory only</SelectItem>
                <SelectItem value="no">Optional only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Enrolled from</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Enrolled to</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{filtered.length} of {rows.length} enrollments</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />Refresh
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No enrollments match these filters.</TableCell></TableRow>
              ) : filtered.slice(0, 500).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.user_name}</div>
                    {r.user_email && <div className="text-xs text-muted-foreground">{r.user_email}</div>}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{r.course_title}</TableCell>
                  <TableCell>{statusBadge(r.status, r.due_at)}</TableCell>
                  <TableCell className="text-right">{r.progress_percent}%</TableCell>
                  <TableCell className="text-right">{r.final_score ?? "—"}</TableCell>
                  <TableCell>{format(new Date(r.enrolled_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>{r.due_at ? format(new Date(r.due_at), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>{r.completed_at ? format(new Date(r.completed_at), "MMM d, yyyy") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 500 && (
            <div className="text-xs text-muted-foreground p-3 border-t">Showing first 500 rows. Refine filters or export CSV for full data.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

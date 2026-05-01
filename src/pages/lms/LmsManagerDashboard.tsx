import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useLmsPermissions } from "@/hooks/useLmsPermissions";
import { AlertTriangle, CheckCircle2, GraduationCap } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LmsManagerDashboard() {
  const { currentOrganization } = useOrganization();
  const { canAdmin } = useLmsPermissions();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("lms_enrollments")
        .select("*, course:lms_courses(title), profile:profiles!lms_enrollments_user_id_fkey(first_name,last_name,email)")
        .eq("organization_id", currentOrganization.id)
        .order("enrolled_at", { ascending: false });
      // Profiles join may not have FK — fallback to manual lookup
      let rows = data ?? [];
      if (rows.length && !rows[0].profile) {
        const userIds = Array.from(new Set(rows.map((r: any) => r.user_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,first_name,last_name,email")
          .in("user_id", userIds);
        const pmap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
        rows = rows.map((r: any) => ({ ...r, profile: pmap.get(r.user_id) }));
      }
      setEnrollments(rows);
      setLoading(false);
    })();
  }, [currentOrganization?.id]);

  if (!canAdmin) {
    return (
      <AppLayout title="Training Dashboard" subtitle="Restricted">
        <Card><CardContent className="py-12 text-center text-muted-foreground">You don't have access to manager reporting.</CardContent></Card>
      </AppLayout>
    );
  }

  const total = enrollments.length;
  const completed = enrollments.filter((e) => e.status === "completed").length;
  const overdue = enrollments.filter((e) => e.due_at && new Date(e.due_at) < new Date() && e.status !== "completed");
  const mandatoryOpen = enrollments.filter((e) => e.mandatory && e.status !== "completed");
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

  const displayName = (p?: any) => p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email : "Unknown user";

  return (
    <AppLayout title="Training Dashboard" subtitle="Org-wide learning compliance and progress">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="py-4">
            <div className="flex justify-between"><p className="text-sm text-muted-foreground">Total enrollments</p><GraduationCap className="h-4 w-4 text-primary" /></div>
            <p className="text-3xl font-semibold mt-1">{total}</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <div className="flex justify-between"><p className="text-sm text-muted-foreground">Completion rate</p><CheckCircle2 className="h-4 w-4 text-primary" /></div>
            <p className="text-3xl font-semibold mt-1">{completionRate}%</p>
            <Progress value={completionRate} className="h-1.5 mt-2" />
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <div className="flex justify-between"><p className="text-sm text-muted-foreground">Overdue</p><AlertTriangle className="h-4 w-4 text-destructive" /></div>
            <p className="text-3xl font-semibold mt-1 text-destructive">{overdue.length}</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <div className="flex justify-between"><p className="text-sm text-muted-foreground">Mandatory open</p><AlertTriangle className="h-4 w-4" /></div>
            <p className="text-3xl font-semibold mt-1">{mandatoryOpen.length}</p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="overdue">
          <TabsList>
            <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
            <TabsTrigger value="mandatory">Mandatory open ({mandatoryOpen.length})</TabsTrigger>
            <TabsTrigger value="all">All enrollments ({total})</TabsTrigger>
          </TabsList>

          <TabsContent value="overdue" className="mt-4">
            <EnrollmentTable rows={overdue} displayName={displayName} loading={loading} />
          </TabsContent>
          <TabsContent value="mandatory" className="mt-4">
            <EnrollmentTable rows={mandatoryOpen} displayName={displayName} loading={loading} />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <EnrollmentTable rows={enrollments} displayName={displayName} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function EnrollmentTable({ rows, displayName, loading }: { rows: any[]; displayName: (p: any) => string; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Nothing to show.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Learner</th>
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const overdue = r.due_at && new Date(r.due_at) < new Date() && r.status !== "completed";
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">{displayName(r.profile)}</td>
                  <td className="px-4 py-2">{r.course?.title ?? "—"}</td>
                  <td className="px-4 py-2 w-40">
                    <div className="flex items-center gap-2">
                      <Progress value={r.progress_percent} className="h-2 flex-1" />
                      <span className="text-xs w-10 text-right">{r.progress_percent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={r.status === "completed" ? "default" : "outline"}>{r.status}</Badge>
                    {r.mandatory && <Badge variant="destructive" className="ml-1">Required</Badge>}
                  </td>
                  <td className={`px-4 py-2 text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {r.due_at ? format(new Date(r.due_at), "PP") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { GraduationCap, AlertTriangle, Award, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ExternalTrainingPanel } from "@/components/lms/ExternalTrainingPanel";

export default function PortalTraining() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["portal-training", user?.id, currentOrganization?.id],
    enabled: !!user?.id && !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("lms_enrollments")
        .select("*, course:lms_courses(id,title,category,est_duration_minutes)")
        .eq("user_id", user!.id)
        .eq("organization_id", currentOrganization!.id)
        .order("enrolled_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["portal-training-catalog", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("lms_courses")
        .select("id,title,description,category,est_duration_minutes")
        .eq("organization_id", currentOrganization!.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const now = Date.now();
  const inProgress = enrollments.filter((e: any) => e.status !== "completed");
  const completed = enrollments.filter((e: any) => e.status === "completed");
  const overdue = inProgress.filter((e: any) => e.due_at && new Date(e.due_at).getTime() < now);
  const enrolledIds = new Set(enrollments.map((e: any) => e.course_id));
  const recommended = catalog.filter((c: any) => !enrolledIds.has(c.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Training</h1>
        <p className="text-sm text-muted-foreground">
          Your assigned courses, progress, certificates, and external training records.
        </p>
      </div>

      <Tabs defaultValue="courses" className="space-y-6">
        <TabsList>
          <TabsTrigger value="courses">Courses & progress</TabsTrigger>
          <TabsTrigger value="external">External training</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="In progress" value={inProgress.length} />
            <Stat label="Overdue" value={overdue.length} accent={overdue.length > 0 ? "danger" : undefined} />
            <Stat label="Completed" value={completed.length} />
            <Stat label="Available" value={recommended.length} />
          </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <GraduationCap className="h-4 w-4" /> Pending training
          </h2>
          <Link to="/learning/my" className="text-sm text-primary hover:underline">View all →</Link>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : inProgress.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending training. You're all caught up! 🎉</p>
        ) : (
          <div className="divide-y">
            {inProgress.slice(0, 6).map((e: any) => {
              const od = e.due_at && new Date(e.due_at).getTime() < now;
              return (
                <Link
                  key={e.id}
                  to={`/learning/courses/${e.course_id}`}
                  className="flex items-center gap-3 py-3 px-2 -mx-2 rounded hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{e.course?.title ?? "Course"}</span>
                      {e.mandatory && <Badge variant="secondary" className="text-xs">Mandatory</Badge>}
                      {od && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={e.progress_percent ?? 0} className="h-1.5 flex-1 max-w-xs" />
                      <span className="text-xs text-muted-foreground">{e.progress_percent ?? 0}%</span>
                    </div>
                    {e.due_at && (
                      <div className={`text-xs mt-1 ${od ? "text-destructive" : "text-muted-foreground"}`}>
                        Due {format(new Date(e.due_at), "PP")}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {recommended.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Award className="h-4 w-4" /> Browse courses
            </h2>
            <Link to="/learning" className="text-sm text-primary hover:underline">Full catalog →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recommended.slice(0, 6).map((c: any) => (
              <Link
                key={c.id}
                to={`/learning/courses/${c.id}`}
                className="block rounded-md border p-3 hover:border-primary/40 transition-colors"
              >
                <div className="font-medium text-sm">{c.title}</div>
                {c.description && (
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.description}</div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {c.category && <Badge variant="outline" className="text-xs">{c.category}</Badge>}
                  {c.est_duration_minutes && (
                    <span className="text-xs text-muted-foreground">{c.est_duration_minutes} min</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Link to="/learning/my">
          <Button variant="outline" size="sm">Open full learning area</Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "danger" }) {
  return (
    <Card className="p-4">
      <div className={`text-3xl font-bold ${accent === "danger" && value > 0 ? "text-destructive" : ""}`}>{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Card>
  );
}

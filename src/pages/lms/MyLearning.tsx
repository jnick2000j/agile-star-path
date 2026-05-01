import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Award, Calendar, Download, AlertTriangle, GraduationCap } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function MyLearning() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !currentOrganization?.id) return;
    (async () => {
      setLoading(true);
      const [er, cr] = await Promise.all([
        supabase
          .from("lms_enrollments")
          .select("*, course:lms_courses(id,title,category,est_duration_minutes,issues_certificate)")
          .eq("user_id", user.id)
          .eq("organization_id", currentOrganization.id)
          .order("enrolled_at", { ascending: false }),
        supabase
          .from("lms_certificates")
          .select("*, course:lms_courses(title)")
          .eq("user_id", user.id)
          .eq("organization_id", currentOrganization.id)
          .order("issued_at", { ascending: false }),
      ]);
      setEnrollments(er.data ?? []);
      setCertificates(cr.data ?? []);
      setLoading(false);
    })();
  }, [user, currentOrganization?.id]);

  const inProgress = enrollments.filter((e) => e.status !== "completed");
  const completed = enrollments.filter((e) => e.status === "completed");
  const overdue = inProgress.filter((e) => e.due_at && new Date(e.due_at) < new Date());

  const downloadCert = async (cert: any) => {
    if (!cert.storage_path) {
      toast.info("Certificate file not yet generated");
      return;
    }
    const { data, error } = await supabase.storage
      .from("lms-certificates")
      .createSignedUrl(cert.storage_path, 600);
    if (error || !data?.signedUrl) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <AppLayout title="My Learning" subtitle="Your enrolled courses, progress, and certificates">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="In progress" value={inProgress.length} icon={<GraduationCap className="h-4 w-4" />} />
          <Stat label="Completed" value={completed.length} icon={<Award className="h-4 w-4" />} />
          <Stat
            label="Overdue"
            value={overdue.length}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone={overdue.length > 0 ? "destructive" : "default"}
          />
          <Stat label="Certificates" value={certificates.length} icon={<Award className="h-4 w-4" />} />
        </div>

        <Tabs defaultValue="in_progress">
          <TabsList>
            <TabsTrigger value="in_progress">In progress ({inProgress.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            <TabsTrigger value="certificates">Certificates ({certificates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="in_progress" className="mt-4 space-y-3">
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : inProgress.length === 0 ? (
              <EmptyState text="No courses in progress." />
            ) : (
              inProgress.map((e) => <EnrollmentCard key={e.id} enrollment={e} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-3">
            {completed.length === 0 ? (
              <EmptyState text="No completed courses yet." />
            ) : (
              completed.map((e) => <EnrollmentCard key={e.id} enrollment={e} />)
            )}
          </TabsContent>

          <TabsContent value="certificates" className="mt-4 space-y-3">
            {certificates.length === 0 ? (
              <EmptyState text="Complete a course to earn a certificate." />
            ) : (
              certificates.map((c) => (
                <Card key={c.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{c.course?.title ?? "Course"}</p>
                      <p className="text-xs text-muted-foreground">
                        Serial {c.serial} · Issued {format(new Date(c.issued_at), "PP")}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadCert(c)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "default" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={tone === "destructive" ? "text-destructive" : "text-primary"}>{icon}</span>
        </div>
        <p className={`text-3xl font-semibold mt-1 ${tone === "destructive" ? "text-destructive" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function EnrollmentCard({ enrollment }: { enrollment: any }) {
  const overdue = enrollment.due_at && new Date(enrollment.due_at) < new Date() && enrollment.status !== "completed";
  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link to={`/learning/courses/${enrollment.course_id}`} className="font-medium hover:underline">
              {enrollment.course?.title ?? "Course"}
            </Link>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              {enrollment.course?.category && <Badge variant="secondary">{enrollment.course.category}</Badge>}
              {enrollment.mandatory && <Badge variant="destructive">Mandatory</Badge>}
              {enrollment.due_at && (
                <span className={`flex items-center gap-1 ${overdue ? "text-destructive font-medium" : ""}`}>
                  <Calendar className="h-3 w-3" />
                  Due {format(new Date(enrollment.due_at), "PP")}
                </span>
              )}
            </div>
          </div>
          <Badge variant={enrollment.status === "completed" ? "default" : "outline"}>{enrollment.status}</Badge>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{enrollment.progress_percent}%</span>
          </div>
          <Progress value={enrollment.progress_percent} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground text-sm">{text}</CardContent>
    </Card>
  );
}

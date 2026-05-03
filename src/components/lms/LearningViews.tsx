import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import {
  Award, Calendar, Download, AlertTriangle, GraduationCap, Search, Clock, Route,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { downloadCertificate, loadCertificateBranding } from "@/lib/certificate";
import { selfEnroll, type LmsCourse, type LmsEnrollment } from "@/lib/lms";

/* ========================================================================== */
/*  Pending / In-progress + Completed                                          */
/* ========================================================================== */

export function MyEnrollmentsView({ filter }: { filter: "in_progress" | "completed" }) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const courseLink = (id: string) => `/learning/courses/${id}`;

  useEffect(() => {
    if (!user || !currentOrganization?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("lms_enrollments")
        .select("*, course:lms_courses(id,title,category,est_duration_minutes,issues_certificate)")
        .eq("user_id", user.id)
        .eq("organization_id", currentOrganization.id)
        .order("enrolled_at", { ascending: false });
      setEnrollments(data ?? []);
      setLoading(false);
    })();
  }, [user, currentOrganization?.id]);

  const list = enrollments.filter((e) =>
    filter === "completed" ? e.status === "completed" : e.status !== "completed",
  );

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (list.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
        {filter === "completed" ? "No completed courses yet." : "No courses in progress. Browse the catalog to get started."}
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((e) => {
        const overdue = e.due_at && new Date(e.due_at) < new Date() && e.status !== "completed";
        return (
          <Card key={e.id}>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <Link to={courseLink(e.course_id)} className="font-medium hover:underline">
                    {e.course?.title ?? "Course"}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    {e.course?.category && <Badge variant="secondary">{e.course.category}</Badge>}
                    {e.mandatory && <Badge variant="destructive">Mandatory</Badge>}
                    {e.due_at && (
                      <span className={`flex items-center gap-1 ${overdue ? "text-destructive font-medium" : ""}`}>
                        <Calendar className="h-3 w-3" />
                        Due {format(new Date(e.due_at), "PP")}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant={e.status === "completed" ? "default" : "outline"}>{e.status}</Badge>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{e.progress_percent ?? 0}%</span>
                </div>
                <Progress value={e.progress_percent ?? 0} className="h-2" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ========================================================================== */
/*  Certificates                                                               */
/* ========================================================================== */

export function MyCertificatesView() {
  const { user, userProfile } = useAuth();
  const { currentOrganization } = useOrganization();
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !currentOrganization?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("lms_certificates")
        .select("*, course:lms_courses(title)")
        .eq("user_id", user.id)
        .eq("organization_id", currentOrganization.id)
        .order("issued_at", { ascending: false });
      setCerts(data ?? []);
      setLoading(false);
    })();
  }, [user, currentOrganization?.id]);

  const downloadCert = async (cert: any) => {
    const recipient =
      [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(" ").trim() ||
      userProfile?.full_name ||
      user?.email ||
      "Learner";
    try {
      const branding = currentOrganization?.id
        ? await loadCertificateBranding(supabase, currentOrganization.id)
        : undefined;
      downloadCertificate({
        recipientName: recipient,
        courseTitle: cert.course?.title ?? "Course",
        organizationName: currentOrganization?.name ?? "Your Organization",
        serial: cert.serial,
        issuedAt: cert.issued_at ? new Date(cert.issued_at) : new Date(),
        finalScore: cert.final_score ?? null,
        branding,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate certificate");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (certs.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
        Complete a course to earn a certificate.
      </CardContent></Card>
    );
  }
  return (
    <div className="space-y-3">
      {certs.map((c) => (
        <Card key={c.id}>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">{c.course?.title ?? "Course"}</p>
              <p className="text-xs text-muted-foreground">
                Serial {c.serial} · Issued {format(new Date(c.issued_at), "PP")}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => downloadCert(c)}>
              <Download className="h-4 w-4 mr-2" />Download
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ========================================================================== */
/*  Catalog (browse + enroll)                                                  */
/* ========================================================================== */

interface PathRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  cover_image_url?: string | null;
}

export function CatalogView() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [courses, setCourses] = useState<LmsCourse[]>([]);
  const [paths, setPaths] = useState<PathRow[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, LmsEnrollment>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!currentOrganization?.id || !user) return;
    (async () => {
      setLoading(true);
      const [coursesRes, pathsRes, enrollRes] = await Promise.all([
        supabase.from("lms_courses").select("*")
          .eq("organization_id", currentOrganization.id)
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase.from("lms_learning_paths").select("id,title,description,status,cover_image_url")
          .eq("organization_id", currentOrganization.id)
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase.from("lms_enrollments").select("*")
          .eq("user_id", user.id)
          .eq("organization_id", currentOrganization.id),
      ]);
      setCourses((coursesRes.data ?? []) as LmsCourse[]);
      setPaths((pathsRes.data ?? []) as PathRow[]);
      const map: Record<string, LmsEnrollment> = {};
      (enrollRes.data ?? []).forEach((e: any) => (map[e.course_id] = e));
      setEnrollments(map);
      setLoading(false);
    })();
  }, [currentOrganization?.id, user]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    courses.forEach((c) => c.category && s.add(c.category));
    return ["all", ...Array.from(s).sort()];
  }, [courses]);
  const [activeCat, setActiveCat] = useState("all");

  const filtered = courses.filter(
    (c) =>
      (activeCat === "all" || c.category === activeCat) &&
      (q === "" || c.title.toLowerCase().includes(q.toLowerCase()) ||
        c.description?.toLowerCase().includes(q.toLowerCase())),
  );

  const handleEnroll = async (course: LmsCourse) => {
    if (!currentOrganization?.id) return;
    const e = await selfEnroll(currentOrganization.id, course.id);
    if (e) {
      setEnrollments((prev) => ({ ...prev, [course.id]: e as LmsEnrollment }));
      toast.success(`Enrolled in ${course.title}`);
    } else if (enrollments[course.id]) {
      toast.info("You're already enrolled");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search courses…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={activeCat === c ? "default" : "outline"}
                onClick={() => setActiveCat(c)}
              >
                {c === "all" ? "All categories" : c}
              </Button>
            ))}
          </div>
        )}
      </div>

      {paths.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Route className="h-4 w-4" />Learning paths
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {paths.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                {p.cover_image_url && (
                  <img src={p.cover_image_url} alt="" className="h-24 w-full object-cover" />
                )}
                <CardContent className="py-3">
                  <p className="font-medium">{p.title}</p>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />Available courses
        </h3>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
            No courses match your filters.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((c) => {
              const enr = enrollments[c.id];
              return (
                <Card key={c.id}>
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/learning/courses/${c.id}`} className="font-medium hover:underline">
                        {c.title}
                      </Link>
                      {c.issues_certificate && (
                        <Badge variant="outline" className="text-xs">
                          <Award className="h-3 w-3 mr-1" />Certificate
                        </Badge>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {c.category && <Badge variant="secondary">{c.category}</Badge>}
                      {c.est_duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />{c.est_duration_minutes} min
                        </span>
                      )}
                    </div>
                    <div className="pt-1">
                      {enr ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/learning/courses/${c.id}`}>
                            {enr.status === "completed" ? "Review" : "Continue"}
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => handleEnroll(c)}>Enroll</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ========================================================================== */
/*  Compact summary stats                                                      */
/* ========================================================================== */

export function LearningStats() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [stats, setStats] = useState({ inProgress: 0, completed: 0, overdue: 0, certificates: 0 });

  useEffect(() => {
    if (!user || !currentOrganization?.id) return;
    (async () => {
      const [er, cr] = await Promise.all([
        supabase.from("lms_enrollments").select("status,due_at")
          .eq("user_id", user.id).eq("organization_id", currentOrganization.id),
        supabase.from("lms_certificates").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("organization_id", currentOrganization.id),
      ]);
      const enr = er.data ?? [];
      const now = Date.now();
      setStats({
        inProgress: enr.filter((e: any) => e.status !== "completed").length,
        completed: enr.filter((e: any) => e.status === "completed").length,
        overdue: enr.filter((e: any) => e.status !== "completed" && e.due_at && new Date(e.due_at).getTime() < now).length,
        certificates: cr.count ?? 0,
      });
    })();
  }, [user, currentOrganization?.id]);

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <StatCard label="In progress" value={stats.inProgress} icon={<GraduationCap className="h-4 w-4" />} />
      <StatCard label="Completed" value={stats.completed} icon={<Award className="h-4 w-4" />} />
      <StatCard label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? "destructive" : "default"} icon={<AlertTriangle className="h-4 w-4" />} />
      <StatCard label="Certificates" value={stats.certificates} icon={<Award className="h-4 w-4" />} />
    </div>
  );
}

function StatCard({ label, value, icon, tone = "default" }: { label: string; value: number; icon: React.ReactNode; tone?: "default" | "destructive" }) {
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

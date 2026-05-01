import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, Search, Clock, Award, AlertTriangle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useLmsPermissions } from "@/hooks/useLmsPermissions";
import { selfEnroll, type LmsCourse, type LmsEnrollment } from "@/lib/lms";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface PathRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

export default function LmsCatalog() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { canAuthor, canAdmin } = useLmsPermissions();
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
        supabase
          .from("lms_courses")
          .select("*")
          .eq("organization_id", currentOrganization.id)
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase
          .from("lms_learning_paths")
          .select("id,title,description,status")
          .eq("organization_id", currentOrganization.id)
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase
          .from("lms_enrollments")
          .select("*")
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
      (q === "" || c.title.toLowerCase().includes(q.toLowerCase()) || c.description?.toLowerCase().includes(q.toLowerCase())),
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
    <AppLayout title="Learning Catalog" subtitle="Browse and enroll in training">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/learning/my">
                <GraduationCap className="h-4 w-4 mr-2" />
                My Learning
              </Link>
            </Button>
            {canAuthor && (
              <Button asChild variant="outline">
                <Link to="/learning/admin">Authoring</Link>
              </Button>
            )}
            {canAdmin && (
              <Button asChild variant="outline">
                <Link to="/learning/dashboard">Manager Dashboard</Link>
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeCat} onValueChange={setActiveCat}>
          <TabsList className="flex-wrap h-auto">
            {categories.map((c) => (
              <TabsTrigger key={c} value={c} className="capitalize">
                {c === "all" ? "All courses" : c}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeCat} className="mt-4 space-y-6">
            {paths.length > 0 && activeCat === "all" && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Learning paths</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paths.map((p) => (
                    <Card key={p.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Award className="h-4 w-4 text-primary" />
                          {p.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">{p.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button asChild size="sm" variant="outline" className="w-full">
                          <Link to={`/learning/paths/${p.id}`}>View path</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold mb-3">Courses</h2>
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-48" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No courses match your search.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((course) => {
                    const enrollment = enrollments[course.id];
                    return (
                      <Card key={course.id} className="flex flex-col hover:shadow-md transition-shadow">
                        {course.cover_image_url && (
                          // eslint-disable-next-line jsx-a11y/img-redundant-alt
                          <img
                            src={course.cover_image_url}
                            alt={`Cover image for ${course.title}`}
                            className="h-32 w-full object-cover rounded-t-lg"
                            loading="lazy"
                          />
                        )}
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base">{course.title}</CardTitle>
                            {enrollment?.mandatory && (
                              <Badge variant="destructive" className="shrink-0">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Required
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-end space-y-3">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {course.category && <Badge variant="secondary">{course.category}</Badge>}
                            {course.est_duration_minutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {course.est_duration_minutes} min
                              </span>
                            )}
                            {course.issues_certificate && (
                              <span className="flex items-center gap-1">
                                <Award className="h-3 w-3" />
                                Certificate
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button asChild size="sm" className="flex-1">
                              <Link to={`/learning/courses/${course.id}`}>
                                {enrollment ? `Resume (${enrollment.progress_percent}%)` : "View course"}
                              </Link>
                            </Button>
                            {!enrollment && (
                              <Button size="sm" variant="outline" onClick={() => handleEnroll(course)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

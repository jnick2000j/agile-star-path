import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useLmsPermissions } from "@/hooks/useLmsPermissions";
import { useAuth } from "@/hooks/useAuth";
import type { LmsCourse, CourseStatus } from "@/lib/lms";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LmsAdmin() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { canAuthor } = useLmsPermissions();
  const [courses, setCourses] = useState<LmsCourse[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LmsCourse | null>(null);

  const reload = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase.from("lms_courses").select("*").eq("organization_id", currentOrganization.id).order("created_at", { ascending: false }),
      supabase.from("lms_learning_paths").select("*").eq("organization_id", currentOrganization.id).order("created_at", { ascending: false }),
    ]);
    setCourses((c.data ?? []) as LmsCourse[]);
    setPaths(p.data ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [currentOrganization?.id]);

  if (!canAuthor) {
    return (
      <AppLayout title="LMS Authoring" subtitle="Restricted">
        <Card><CardContent className="py-12 text-center text-muted-foreground">You don't have access to LMS authoring.</CardContent></Card>
      </AppLayout>
    );
  }

  const saveCourse = async (form: Partial<LmsCourse>) => {
    if (!currentOrganization?.id || !user) return;
    let courseId: string | undefined;
    if (editing) {
      const { error } = await supabase.from("lms_courses").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      courseId = editing.id;
      toast.success("Course updated");
    } else {
      const { data, error } = await supabase.from("lms_courses").insert({
        ...form,
        organization_id: currentOrganization.id,
        created_by: user.id,
        title: form.title || "Untitled course",
      } as any).select("id").single();
      if (error) return toast.error(error.message);
      courseId = data?.id;
      toast.success("Course created");
    }

    // Reindex into the shared KB / chat search whenever a course is touched.
    // Fire-and-forget: a trigger has already flagged kb_index_status=pending.
    if (courseId) {
      supabase.functions.invoke("lms-embed-course", { body: { course_id: courseId } })
        .catch((e) => console.warn("lms-embed-course failed:", e));
    }

    setOpen(false);
    setEditing(null);
    await reload();
  };

  return (
    <AppLayout title="LMS Authoring" subtitle="Manage courses, learning paths, and quizzes">
      <Tabs defaultValue="courses" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="courses">Courses ({courses.length})</TabsTrigger>
            <TabsTrigger value="paths">Learning paths ({paths.length})</TabsTrigger>
          </TabsList>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New course</Button>
            </DialogTrigger>
            <CourseDialog editing={editing} onSave={saveCourse} />
          </Dialog>
        </div>

        <TabsContent value="courses" className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : courses.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No courses yet. Create your first one.</CardContent></Card>
          ) : courses.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to={`/learning/courses/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                    <Badge variant={c.status === "published" ? "default" : "outline"}>{c.status}</Badge>
                    {c.category && <Badge variant="secondary">{c.category}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.description}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/learning/admin/courses/${c.id}`}>Edit content</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="paths" className="space-y-3">
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Learning paths support is available via the database. A path builder UI is on the roadmap — for now, paths can be created via the API.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function CourseDialog({ editing, onSave }: { editing: LmsCourse | null; onSave: (f: Partial<LmsCourse>) => void }) {
  const [form, setForm] = useState<Partial<LmsCourse>>(() => editing ?? {
    title: "", description: "", category: "", status: "draft" as CourseStatus,
    passing_score_percent: 80, issues_certificate: true, est_duration_minutes: 30,
  });
  useEffect(() => { if (editing) setForm(editing); }, [editing]);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status ?? "draft"} onValueChange={(v) => setForm({ ...form, status: v as CourseStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Est. duration (min)</Label>
            <Input type="number" value={form.est_duration_minutes ?? 0} onChange={(e) => setForm({ ...form, est_duration_minutes: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Passing score (%)</Label>
            <Input type="number" min={0} max={100} value={form.passing_score_percent ?? 80} onChange={(e) => setForm({ ...form, passing_score_percent: Number(e.target.value) })} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(form)}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}

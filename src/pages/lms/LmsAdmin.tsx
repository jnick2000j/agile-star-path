import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useLmsPermissions } from "@/hooks/useLmsPermissions";
import { useAuth } from "@/hooks/useAuth";
import type { LmsCourse, CourseStatus } from "@/lib/lms";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PathStatus = "draft" | "published" | "archived";
interface LearningPath {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  status: PathStatus;
  cover_image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
interface PathCourse {
  id: string;
  path_id: string;
  course_id: string;
  position: number;
  required: boolean;
}

export default function LmsAdmin() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { canAuthor } = useLmsPermissions();
  const [courses, setCourses] = useState<LmsCourse[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);

  const [courseOpen, setCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<LmsCourse | null>(null);

  const [pathOpen, setPathOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<LearningPath | null>(null);

  const [managePath, setManagePath] = useState<LearningPath | null>(null);

  const reload = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase.from("lms_courses").select("*").eq("organization_id", currentOrganization.id).order("created_at", { ascending: false }),
      supabase.from("lms_learning_paths").select("*").eq("organization_id", currentOrganization.id).order("created_at", { ascending: false }),
    ]);
    setCourses((c.data ?? []) as LmsCourse[]);
    setPaths((p.data ?? []) as LearningPath[]);
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
    if (editingCourse) {
      const { error } = await supabase.from("lms_courses").update(form).eq("id", editingCourse.id);
      if (error) return toast.error(error.message);
      courseId = editingCourse.id;
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

    if (courseId) {
      supabase.functions.invoke("lms-embed-course", { body: { course_id: courseId } })
        .catch((e) => console.warn("lms-embed-course failed:", e));
    }

    setCourseOpen(false);
    setEditingCourse(null);
    await reload();
  };

  const savePath = async (form: Partial<LearningPath>) => {
    if (!currentOrganization?.id || !user) return;
    if (!form.title?.trim()) return toast.error("Title is required");
    if (editingPath) {
      const { error } = await supabase.from("lms_learning_paths").update({
        title: form.title,
        description: form.description ?? null,
        status: form.status ?? "draft",
      }).eq("id", editingPath.id);
      if (error) return toast.error(error.message);
      toast.success("Learning path updated");
    } else {
      const { error } = await supabase.from("lms_learning_paths").insert({
        organization_id: currentOrganization.id,
        created_by: user.id,
        title: form.title,
        description: form.description ?? null,
        status: (form.status ?? "draft") as PathStatus,
      } as any);
      if (error) return toast.error(error.message);
      toast.success("Learning path created");
    }
    setPathOpen(false);
    setEditingPath(null);
    await reload();
  };

  const deletePath = async (id: string) => {
    if (!confirm("Delete this learning path? Course assignments will be removed.")) return;
    const { error } = await supabase.from("lms_learning_paths").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Learning path deleted");
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
          <div className="flex gap-2">
            <Dialog open={pathOpen} onOpenChange={(o) => { setPathOpen(o); if (!o) setEditingPath(null); }}>
              <DialogTrigger asChild>
                <Button variant="outline"><Route className="h-4 w-4 mr-2" />New path</Button>
              </DialogTrigger>
              <PathDialog editing={editingPath} onSave={savePath} />
            </Dialog>
            <Dialog open={courseOpen} onOpenChange={(o) => { setCourseOpen(o); if (!o) setEditingCourse(null); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />New course</Button>
              </DialogTrigger>
              <CourseDialog editing={editingCourse} onSave={saveCourse} />
            </Dialog>
          </div>
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
                  <Button size="sm" variant="ghost" onClick={() => { setEditingCourse(c); setCourseOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="paths" className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : paths.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              No learning paths yet. Click <strong>New path</strong> to create one.
            </CardContent></Card>
          ) : paths.map((p) => (
            <Card key={p.id}>
              <CardContent className="py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.title}</span>
                    <Badge variant={p.status === "published" ? "default" : "outline"}>{p.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setManagePath(p)}>
                    Manage courses
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingPath(p); setPathOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deletePath(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {managePath && (
        <ManagePathDialog
          path={managePath}
          allCourses={courses}
          onClose={() => setManagePath(null)}
        />
      )}
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

function PathDialog({ editing, onSave }: { editing: LearningPath | null; onSave: (f: Partial<LearningPath>) => void }) {
  const [form, setForm] = useState<Partial<LearningPath>>(() => editing ?? {
    title: "", description: "", status: "draft",
  });
  useEffect(() => {
    setForm(editing ?? { title: "", description: "", status: "draft" });
  }, [editing]);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit learning path" : "New learning path"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input
            value={form.title ?? ""}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Onboarding for new project managers"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What learners will achieve by completing this path"
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status ?? "draft"} onValueChange={(v) => setForm({ ...form, status: v as PathStatus })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(form)}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ManagePathDialog({
  path,
  allCourses,
  onClose,
}: {
  path: LearningPath;
  allCourses: LmsCourse[];
  onClose: () => void;
}) {
  const [items, setItems] = useState<PathCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [addCourseId, setAddCourseId] = useState<string>("");

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lms_learning_path_courses")
      .select("*")
      .eq("path_id", path.id)
      .order("position", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data ?? []) as PathCourse[]);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [path.id]);

  const usedIds = new Set(items.map((i) => i.course_id));
  const available = allCourses.filter((c) => !usedIds.has(c.id));

  const addCourse = async () => {
    if (!addCourseId) return;
    const nextPos = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    const { error } = await supabase.from("lms_learning_path_courses").insert({
      path_id: path.id,
      course_id: addCourseId,
      position: nextPos,
      required: true,
    } as any);
    if (error) return toast.error(error.message);
    setAddCourseId("");
    await reload();
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("lms_learning_path_courses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  };

  const toggleRequired = async (item: PathCourse) => {
    const { error } = await supabase
      .from("lms_learning_path_courses")
      .update({ required: !item.required })
      .eq("id", item.id);
    if (error) return toast.error(error.message);
    await reload();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[idx];
    const b = items[target];
    // Swap positions in two updates.
    const { error: e1 } = await supabase
      .from("lms_learning_path_courses")
      .update({ position: b.position })
      .eq("id", a.id);
    const { error: e2 } = await supabase
      .from("lms_learning_path_courses")
      .update({ position: a.position })
      .eq("id", b.id);
    if (e1 || e2) return toast.error((e1 ?? e2)!.message);
    await reload();
  };

  const courseTitle = (id: string) => allCourses.find((c) => c.id === id)?.title ?? id.slice(0, 8);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Courses in “{path.title}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Select value={addCourseId} onValueChange={setAddCourseId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={available.length ? "Pick a course to add" : "All courses already in path"} />
              </SelectTrigger>
              <SelectContent>
                {available.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addCourse} disabled={!addCourseId}>
              <Plus className="h-4 w-4 mr-2" /> Add
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No courses in this path yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <Card key={it.id}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6 text-center">{idx + 1}</span>
                    <span className="flex-1 truncate">{courseTitle(it.course_id)}</span>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={it.required} onCheckedChange={() => toggleRequired(it)} />
                      Required
                    </label>
                    <Button size="icon" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(it.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Upload, Pencil, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { uploadLmsContent, type LessonType, type LmsLesson, type LmsModule } from "@/lib/lms";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const minsToSecs = (m: number) => (m > 0 ? Math.round(m * 60) : null);
const secsToMins = (s: number | null | undefined) => (s ? Math.round(s / 60) : 0);

export default function LmsCourseEditor() {
  const { id: courseId } = useParams<{ id: string }>();
  const { currentOrganization } = useOrganization();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<LmsModule[]>([]);
  const [lessons, setLessons] = useState<LmsLesson[]>([]);
  const [editingModule, setEditingModule] = useState<LmsModule | null>(null);
  const [editingLesson, setEditingLesson] = useState<LmsLesson | null>(null);

  const reload = async () => {
    if (!courseId) return;
    const [c, m, l] = await Promise.all([
      supabase.from("lms_courses").select("*").eq("id", courseId).maybeSingle(),
      supabase.from("lms_modules").select("*").eq("course_id", courseId).order("position"),
      supabase.from("lms_lessons").select("*").eq("course_id", courseId).order("position"),
    ]);
    setCourse(c.data);
    setModules((m.data ?? []) as LmsModule[]);
    setLessons((l.data ?? []) as LmsLesson[]);
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [courseId]);

  const deleteModule = async (id: string) => {
    if (!confirm("Delete this module and its lessons?")) return;
    const { error } = await supabase.from("lms_modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  };

  const deleteLesson = async (id: string) => {
    const { error } = await supabase.from("lms_lessons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  };

  if (!course) {
    return <AppLayout title="Course editor"><p className="text-sm text-muted-foreground">Loading…</p></AppLayout>;
  }

  return (
    <AppLayout title={`Edit: ${course.title}`} subtitle="Manage modules, lessons, and quizzes">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/learning/admin"><ArrowLeft className="h-4 w-4 mr-2" />Back to authoring</Link>
        </Button>

        {course.min_required_seconds ? (
          <Card><CardContent className="py-3 text-xs text-muted-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Course-wide minimum time on content: <span className="font-medium text-foreground">{secsToMins(course.min_required_seconds)} min</span>
          </CardContent></Card>
        ) : null}

        <div className="flex justify-end">
          <ModuleDialog
            courseId={courseId!}
            position={modules.length}
            onSaved={reload}
            trigger={<Button><Plus className="h-4 w-4 mr-2" />Add module</Button>}
          />
        </div>

        {modules.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No modules yet. Add your first module to start adding lessons.</CardContent></Card>
        )}

        {modules.map((m) => (
          <Card key={m.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-base">{m.title}</CardTitle>
                {m.min_required_seconds ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Min time: {secsToMins(m.min_required_seconds)} min
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <AddLessonDialog
                  courseId={courseId!}
                  moduleId={m.id}
                  orgId={currentOrganization?.id ?? ""}
                  position={lessons.filter((l) => l.module_id === m.id).length}
                  onCreated={reload}
                />
                <Button size="icon" variant="ghost" onClick={() => setEditingModule(m)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteModule(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {lessons.filter((l) => l.module_id === m.id).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-accent">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="capitalize">{l.lesson_type.replace("_", " ")}</Badge>
                      <span className="truncate">{l.title}</span>
                      {l.min_required_seconds ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" /> {secsToMins(l.min_required_seconds)}m min
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      {l.lesson_type === "quiz" && (
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/learning/admin/lessons/${l.id}/quiz`}>Edit quiz</Link>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setEditingLesson(l)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteLesson(l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
                {lessons.filter((l) => l.module_id === m.id).length === 0 && (
                  <li className="text-xs text-muted-foreground px-2 py-2">No lessons in this module yet.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}

        {editingModule && (
          <ModuleDialog
            courseId={courseId!}
            position={editingModule.position}
            editing={editingModule}
            onSaved={async () => { setEditingModule(null); await reload(); }}
            onClose={() => setEditingModule(null)}
            openControlled
          />
        )}

        {editingLesson && (
          <EditLessonDialog
            lesson={editingLesson}
            onSaved={async () => { setEditingLesson(null); await reload(); }}
            onClose={() => setEditingLesson(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}

function ModuleDialog({
  courseId, position, editing, onSaved, onClose, openControlled, trigger,
}: {
  courseId: string;
  position: number;
  editing?: LmsModule;
  onSaved: () => void;
  onClose?: () => void;
  openControlled?: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!openControlled);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [minMinutes, setMinMinutes] = useState<number>(secsToMins(editing?.min_required_seconds ?? null));
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (openControlled) setOpen(true); }, [openControlled]);

  const submit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setBusy(true);
    const payload = {
      title,
      description: description || null,
      min_required_seconds: minsToSecs(minMinutes),
    };
    const { error } = editing
      ? await supabase.from("lms_modules").update(payload).eq("id", editing.id)
      : await supabase.from("lms_modules").insert({ ...payload, course_id: courseId, position });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Module updated" : "Module added");
    setOpen(false);
    if (!editing) { setTitle(""); setDescription(""); setMinMinutes(0); }
    onSaved();
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit module" : "Add module"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea rows={2} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Minimum time on module (min)</Label>
            <Input
              type="number"
              min={0}
              value={minMinutes}
              onChange={(e) => setMinMinutes(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Total time learners must spend across this module's lessons. Leave 0 for no minimum.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLessonDialog({ courseId, moduleId, orgId, position, onCreated }: {
  courseId: string; moduleId: string; orgId: string; position: number; onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LessonType>("video_embed");
  const [embedUrl, setEmbedUrl] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [required, setRequired] = useState(true);
  const [minMinutes, setMinMinutes] = useState(0);

  const submit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setBusy(true);
    let storage_path: string | null = null;
    if ((type === "video_upload" || type === "document") && file) {
      storage_path = await uploadLmsContent(orgId, courseId, file);
      if (!storage_path) { setBusy(false); return toast.error("Upload failed"); }
    }
    const { error } = await supabase.from("lms_lessons").insert({
      course_id: courseId, module_id: moduleId, title, lesson_type: type, position, required,
      embed_url: type === "video_embed" ? embedUrl : null,
      content_md: type === "document" ? contentMd : null,
      storage_path,
      min_required_seconds: minsToSecs(minMinutes),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Lesson added");
    setOpen(false); setTitle(""); setEmbedUrl(""); setContentMd(""); setFile(null); setMinMinutes(0);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Add lesson</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add lesson</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as LessonType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video_embed">External video (YouTube/Vimeo/Loom)</SelectItem>
                <SelectItem value="video_upload">Uploaded video</SelectItem>
                <SelectItem value="document">Document / slides</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "video_embed" && (
            <div>
              <Label>Video URL</Label>
              <Input placeholder="https://youtube.com/watch?v=…" value={embedUrl} onChange={(e) => setEmbedUrl(e.target.value)} />
            </div>
          )}
          {(type === "video_upload" || type === "document") && (
            <div>
              <Label className="flex items-center gap-2"><Upload className="h-4 w-4" /> File</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}
          {type === "document" && (
            <div>
              <Label>Inline notes (optional, markdown)</Label>
              <Textarea rows={4} value={contentMd} onChange={(e) => setContentMd(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Minimum time on lesson (min)</Label>
            <Input
              type="number"
              min={0}
              value={minMinutes}
              onChange={(e) => setMinMinutes(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Learner must spend at least this many minutes on this lesson before marking it complete. Leave 0 to disable.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="req" checked={required} onCheckedChange={(c) => setRequired(!!c)} />
            <Label htmlFor="req">Required for course completion</Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Add lesson"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLessonDialog({
  lesson, onSaved, onClose,
}: { lesson: LmsLesson; onSaved: () => void; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState(lesson.title);
  const [required, setRequired] = useState(lesson.required);
  const [minMinutes, setMinMinutes] = useState(secsToMins(lesson.min_required_seconds ?? null));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setBusy(true);
    const { error } = await supabase.from("lms_lessons").update({
      title, required, min_required_seconds: minsToSecs(minMinutes),
    }).eq("id", lesson.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Lesson updated");
    setOpen(false);
    onSaved();
  };

  const handleOpenChange = (v: boolean) => { setOpen(v); if (!v) onClose(); };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit lesson</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Minimum time on lesson (min)</Label>
            <Input type="number" min={0} value={minMinutes} onChange={(e) => setMinMinutes(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground mt-1">
              Set to 0 to remove the minimum.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="req-edit" checked={required} onCheckedChange={(c) => setRequired(!!c)} />
            <Label htmlFor="req-edit">Required for course completion</Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

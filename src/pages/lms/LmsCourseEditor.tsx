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
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { uploadLmsContent, type LessonType, type LmsLesson, type LmsModule } from "@/lib/lms";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export default function LmsCourseEditor() {
  const { id: courseId } = useParams<{ id: string }>();
  const { currentOrganization } = useOrganization();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<LmsModule[]>([]);
  const [lessons, setLessons] = useState<LmsLesson[]>([]);

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

  const addModule = async () => {
    if (!courseId) return;
    const title = prompt("Module title?");
    if (!title) return;
    const { error } = await supabase.from("lms_modules").insert({
      course_id: courseId, title, position: modules.length,
    });
    if (error) return toast.error(error.message);
    await reload();
  };

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

        <div className="flex justify-end">
          <Button onClick={addModule}><Plus className="h-4 w-4 mr-2" />Add module</Button>
        </div>

        {modules.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No modules yet. Add your first module to start adding lessons.</CardContent></Card>
        )}

        {modules.map((m) => (
          <Card key={m.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{m.title}</CardTitle>
              <div className="flex gap-2">
                <AddLessonDialog
                  courseId={courseId!}
                  moduleId={m.id}
                  orgId={currentOrganization?.id ?? ""}
                  position={lessons.filter((l) => l.module_id === m.id).length}
                  onCreated={reload}
                />
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
                    </div>
                    <div className="flex items-center gap-1">
                      {l.lesson_type === "quiz" && (
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/learning/admin/lessons/${l.id}/quiz`}>Edit quiz</Link>
                        </Button>
                      )}
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
      </div>
    </AppLayout>
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
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Lesson added");
    setOpen(false); setTitle(""); setEmbedUrl(""); setContentMd(""); setFile(null);
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

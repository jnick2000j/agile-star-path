import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Question { id: string; question: string; multi_select: boolean; position: number; options: { id: string; option_text: string; is_correct: boolean; position: number }[]; }

export default function LmsQuizEditor() {
  const { id: lessonId } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const reload = async () => {
    if (!lessonId) return;
    const [l, q] = await Promise.all([
      supabase.from("lms_lessons").select("*").eq("id", lessonId).maybeSingle(),
      supabase.from("lms_quiz_questions").select("*, options:lms_quiz_options(*)").eq("lesson_id", lessonId).order("position"),
    ]);
    setLesson(l.data);
    setQuestions(((q.data ?? []) as any[]).map((row) => ({
      ...row,
      options: (row.options ?? []).sort((a: any, b: any) => a.position - b.position),
    })));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [lessonId]);

  const addQuestion = async () => {
    if (!lessonId) return;
    const text = prompt("Question text?");
    if (!text) return;
    const { error } = await supabase.from("lms_quiz_questions").insert({
      lesson_id: lessonId, question: text, position: questions.length,
    });
    if (error) return toast.error(error.message);
    await reload();
  };

  const addOption = async (qid: string, count: number) => {
    const text = prompt("Option text?");
    if (!text) return;
    const { error } = await supabase.from("lms_quiz_options").insert({
      question_id: qid, option_text: text, position: count,
    });
    if (error) return toast.error(error.message);
    await reload();
  };

  const toggleCorrect = async (oid: string, checked: boolean) => {
    await supabase.from("lms_quiz_options").update({ is_correct: checked }).eq("id", oid);
    await reload();
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete question?")) return;
    await supabase.from("lms_quiz_questions").delete().eq("id", id);
    await reload();
  };

  const deleteOption = async (id: string) => {
    await supabase.from("lms_quiz_options").delete().eq("id", id);
    await reload();
  };

  const toggleMulti = async (qid: string, multi: boolean) => {
    await supabase.from("lms_quiz_questions").update({ multi_select: multi }).eq("id", qid);
    await reload();
  };

  if (!lesson) return <AppLayout title="Quiz editor"><p className="text-sm text-muted-foreground">Loading…</p></AppLayout>;

  return (
    <AppLayout title={`Quiz: ${lesson.title}`} subtitle="Define questions, options, and correct answers">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/learning/admin/courses/${lesson.course_id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to course
          </Link>
        </Button>

        <div className="flex justify-end">
          <Button onClick={addQuestion}><Plus className="h-4 w-4 mr-2" />Add question</Button>
        </div>

        {questions.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No questions yet.</CardContent></Card>
        )}

        {questions.map((q, idx) => (
          <Card key={q.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Q{idx + 1}. {q.question}</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Checkbox id={`m-${q.id}`} checked={q.multi_select} onCheckedChange={(c) => toggleMulti(q.id, !!c)} />
                  <Label htmlFor={`m-${q.id}`} className="text-xs">Allow multiple correct answers</Label>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => deleteQuestion(q.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {q.options.map((o) => (
                  <li key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
                    <Checkbox checked={o.is_correct} onCheckedChange={(c) => toggleCorrect(o.id, !!c)} />
                    <span className="flex-1">{o.option_text}</span>
                    {o.is_correct && <span className="text-xs text-primary">Correct</span>}
                    <Button size="icon" variant="ghost" onClick={() => deleteOption(o.id)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => addOption(q.id, q.options.length)}>
                <Plus className="h-4 w-4 mr-1" />Add option
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}

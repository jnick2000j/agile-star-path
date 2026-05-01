import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

interface QuizRow {
  question_id: string;
  question: string;
  multi_select: boolean;
  q_position: number;
  option_id: string;
  option_text: string;
  o_position: number;
}

interface Question {
  id: string;
  question: string;
  multi_select: boolean;
  options: { id: string; text: string }[];
}

interface QuizPlayerProps {
  lessonId: string;
  passingScore: number;
  onPassed: () => void;
}

export function QuizPlayer({ lessonId, passingScore, onPassed }: QuizPlayerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; attempt: number } | null>(null);

  useEffect(() => {
    setResult(null);
    setAnswers({});
    (async () => {
      const { data, error } = await supabase.rpc("lms_get_quiz_for_attempt", { _lesson_id: lessonId });
      if (error) {
        console.error(error);
        toast.error("Could not load quiz");
        return;
      }
      const rows = (data ?? []) as QuizRow[];
      const map = new Map<string, Question>();
      rows.forEach((r) => {
        if (!map.has(r.question_id)) {
          map.set(r.question_id, {
            id: r.question_id,
            question: r.question,
            multi_select: r.multi_select,
            options: [],
          });
        }
        map.get(r.question_id)!.options.push({ id: r.option_id, text: r.option_text });
      });
      setQuestions(Array.from(map.values()));
    })();
  }, [lessonId]);

  const setSingle = (qid: string, oid: string) => setAnswers((a) => ({ ...a, [qid]: [oid] }));
  const toggleMulti = (qid: string, oid: string, checked: boolean) =>
    setAnswers((a) => {
      const cur = a[qid] ?? [];
      return { ...a, [qid]: checked ? [...cur, oid] : cur.filter((x) => x !== oid) };
    });

  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.rpc("lms_submit_quiz", { _lesson_id: lessonId, _answers: answers });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = (data as any[])?.[0];
    if (!row) return;
    setResult({ score: row.score_percent, passed: row.passed, attempt: row.attempt_number });
    if (row.passed) {
      toast.success(`Passed! Score: ${row.score_percent}%`);
      onPassed();
    } else {
      toast.error(`Score ${row.score_percent}% — below passing (${passingScore}%)`);
    }
  };

  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>;
  }

  return (
    <div className="space-y-4">
      {result && (
        <Card className={result.passed ? "border-primary" : "border-destructive"}>
          <CardContent className="py-4 flex items-center gap-3">
            {result.passed ? (
              <CheckCircle2 className="h-6 w-6 text-primary" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive" />
            )}
            <div>
              <p className="font-medium">
                {result.passed ? "Passed" : "Not passed"} — Score: {result.score}%
              </p>
              <p className="text-xs text-muted-foreground">
                Attempt #{result.attempt} · Required: {passingScore}%
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {questions.map((q, idx) => (
        <Card key={q.id}>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">
                Q{idx + 1}
              </Badge>
              <p className="font-medium">{q.question}</p>
              {q.multi_select && (
                <Badge variant="secondary" className="ml-auto">
                  Select all
                </Badge>
              )}
            </div>
            {q.multi_select ? (
              <div className="space-y-2 pl-8">
                {q.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`${q.id}-${o.id}`}
                      checked={(answers[q.id] ?? []).includes(o.id)}
                      onCheckedChange={(c) => toggleMulti(q.id, o.id, !!c)}
                    />
                    <Label htmlFor={`${q.id}-${o.id}`} className="cursor-pointer">
                      {o.text}
                    </Label>
                  </div>
                ))}
              </div>
            ) : (
              <RadioGroup
                value={(answers[q.id] ?? [])[0] ?? ""}
                onValueChange={(v) => setSingle(q.id, v)}
                className="pl-8"
              >
                {q.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <RadioGroupItem id={`${q.id}-${o.id}`} value={o.id} />
                    <Label htmlFor={`${q.id}-${o.id}`} className="cursor-pointer">
                      {o.text}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={submitting || Object.keys(answers).length === 0}>
          {submitting ? "Grading…" : result ? "Retake" : "Submit quiz"}
        </Button>
      </div>
    </div>
  );
}

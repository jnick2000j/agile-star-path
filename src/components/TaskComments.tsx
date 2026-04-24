import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Trash2, TrendingUp, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatLabel } from "@/lib/utils";

interface TaskCommentsProps {
  taskId: string;
  organizationId: string | null | undefined;
  currentCompletion: number;
}

interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string | null;
  previous_status: string | null;
  new_status: string | null;
  completion_percentage: number | null;
  created_at: string;
}

export function TaskComments({ taskId, organizationId, currentCompletion }: TaskCommentsProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [progress, setProgress] = useState<string>("");
  const [posting, setPosting] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TaskComment[];
    },
    enabled: !!taskId,
  });

  // Resolve author display names
  const authorIds = Array.from(new Set(comments.map((c) => c.author_id))).filter(Boolean);
  const { data: authors = [] } = useQuery({
    queryKey: ["task-comment-authors", taskId, authorIds.join(",")],
    queryFn: async () => {
      if (!authorIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", authorIds);
      return data ?? [];
    },
    enabled: authorIds.length > 0,
  });
  const authorMap = new Map<string, { full_name: string | null; email: string | null }>();
  authors.forEach((a: { user_id: string; full_name: string | null; email: string | null }) =>
    authorMap.set(a.user_id, { full_name: a.full_name, email: a.email }),
  );

  const submit = async () => {
    if (!user || !organizationId) {
      toast.error("Not signed in");
      return;
    }
    const trimmed = body.trim();
    const pctNum = progress === "" ? null : Number(progress);
    if (!trimmed && pctNum === null) {
      toast.error("Add a comment or a progress update");
      return;
    }
    if (pctNum !== null && (Number.isNaN(pctNum) || pctNum < 0 || pctNum > 100)) {
      toast.error("Progress must be between 0 and 100");
      return;
    }
    setPosting(true);

    // If a progress value is provided, also patch the task itself.
    if (pctNum !== null && pctNum !== currentCompletion) {
      const { error: tErr } = await supabase
        .from("tasks")
        .update({ completion_percentage: pctNum })
        .eq("id", taskId);
      if (tErr) {
        toast.error(tErr.message);
        setPosting(false);
        return;
      }
    }

    const { error } = await supabase.from("task_comments").insert({
      task_id: taskId,
      organization_id: organizationId,
      author_id: user.id,
      body: trimmed || null,
      completion_percentage: pctNum,
    });
    if (error) {
      toast.error(error.message);
      setPosting(false);
      return;
    }
    setBody("");
    setProgress("");
    toast.success("Comment added");
    qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
    setPosting(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("task_comments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-semibold">Comments &amp; Progress</Label>
        <Badge variant="outline" className="text-xs ml-auto">
          {comments.length}
        </Badge>
      </div>

      <Card className="p-3 space-y-2">
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment or progress note…"
        />
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Progress %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              placeholder={String(currentCompletion)}
              className="w-24"
            />
          </div>
          <Button onClick={submit} disabled={posting} size="sm" className="ml-auto">
            Post
          </Button>
        </div>
      </Card>

      {isLoading && <p className="text-xs text-muted-foreground">Loading comments…</p>}
      {!isLoading && comments.length === 0 && (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      )}

      <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
        {comments.map((c) => {
          const author = authorMap.get(c.author_id);
          const authorName = author?.full_name || author?.email || "Unknown";
          const isMine = user?.id === c.author_id;
          const isStatusChange = !!c.previous_status && !!c.new_status;
          const isProgress = c.completion_percentage !== null;
          return (
            <Card key={c.id} className="p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.created_at), "PPp")}
                  </span>
                </div>
                {isMine && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => remove(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              {isStatusChange && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">{formatLabel(c.previous_status!)}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge>{formatLabel(c.new_status!)}</Badge>
                </div>
              )}
              {isProgress && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  Progress set to {c.completion_percentage}%
                </div>
              )}
              {c.body && <p className="text-sm whitespace-pre-wrap">{c.body}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageSquarePlus, BookOpen } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export default function HelpArticle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState("");

  const { data: article, isLoading } = useQuery({
    queryKey: ["help-article", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kb_articles")
        .select("id, organization_id, title, body, summary, category, tags, view_count, helpful_count, not_helpful_count, updated_at, visibility, status")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Increment view count
  useEffect(() => {
    if (article?.id) {
      supabase.rpc("kb_increment_view", { p_article_id: article.id });
    }
  }, [article?.id]);

  const submitFeedback = useMutation({
    mutationFn: async ({ helpful, withComment }: { helpful: boolean; withComment?: boolean }) => {
      if (!article) return;
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("kb_article_feedback").insert({
        article_id: article.id,
        organization_id: article.organization_id,
        is_helpful: helpful,
        comment: withComment ? comment : null,
        user_id: user.user?.id ?? null,
      } as any);
      if (error) throw error;
      setFeedbackGiven(helpful);
    },
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
      setShowCommentBox(false);
      setComment("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const recordDeflection = useMutation({
    mutationFn: async (resolved: boolean) => {
      if (!article) return;
      const { data: user } = await supabase.auth.getUser();
      await supabase.from("kb_ticket_deflections").insert({
        organization_id: article.organization_id,
        article_id: article.id,
        user_id: user.user?.id ?? null,
        resolved_without_ticket: resolved,
      } as any);
    },
  });

  if (isLoading) return <div className="min-h-screen p-6">Loading...</div>;
  if (!article) {
    return (
      <div className="min-h-screen p-6">
        <Card className="max-w-2xl mx-auto p-8 text-center">
          <p className="text-muted-foreground mb-4">Article not found or not publicly available</p>
          <Button asChild><Link to="/help">Back to Help Center</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/help")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Help Center
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/help/submit"><MessageSquarePlus className="h-4 w-4 mr-1" /> Submit Request</Link>
          </Button>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          {article.category && <Badge variant="outline" className="mb-3">{article.category}</Badge>}
          <h1 className="text-3xl font-bold mb-2">{article.title}</h1>
          {article.summary && <p className="text-lg text-muted-foreground">{article.summary}</p>}
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{article.body || "*No content*"}</ReactMarkdown>
        </div>

        <Card className="p-6 bg-muted/30">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Was this helpful?
          </h3>
          {feedbackGiven === null ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => submitFeedback.mutate({ helpful: true })}>
                <ThumbsUp className="h-4 w-4 mr-2" /> Yes
              </Button>
              <Button variant="outline" onClick={() => { setShowCommentBox(true); setFeedbackGiven(false); }}>
                <ThumbsDown className="h-4 w-4 mr-2" /> No
              </Button>
            </div>
          ) : feedbackGiven ? (
            <div className="text-sm text-success">
              ✓ Thanks for the feedback!
              <Button variant="link" className="text-sm" onClick={() => recordDeflection.mutate(true)}>
                I solved my issue
              </Button>
            </div>
          ) : showCommentBox ? (
            <div className="space-y-2">
              <Textarea
                placeholder="What were you looking for?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => submitFeedback.mutate({ helpful: false, withComment: true })}>
                  Submit feedback
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/help/submit">Submit a request instead</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <div className="text-xs text-muted-foreground pt-4 border-t">
          {article.view_count ?? 0} views · {article.helpful_count ?? 0} found this helpful
        </div>
      </article>
    </div>
  );
}

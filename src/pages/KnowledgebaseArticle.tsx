import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ThumbsUp, ThumbsDown, Edit, Sparkles, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery } from "@tanstack/react-query";
import { Markdown } from "@/components/ui/markdown";
import { format } from "date-fns";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { KBArticleDialog } from "@/components/kb/KBArticleDialog";
import { toast } from "sonner";

export default function KnowledgebaseArticle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessLevel } = useOrgAccessLevel();
  const canEdit = ["admin", "manager", "editor"].includes(accessLevel ?? "");
  const [editOpen, setEditOpen] = useState(false);
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null);

  const { data: article, refetch } = useQuery({
    queryKey: ["kb-article", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kb_articles")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Increment view count once
  useEffect(() => {
    if (!article) return;
    supabase
      .from("kb_articles")
      .update({ view_count: (article.view_count ?? 0) + 1 })
      .eq("id", article.id)
      .then(() => {});
  }, [article?.id]);

  const submitFeedback = async (helpful: boolean) => {
    if (!article || feedback) return;
    setFeedback(helpful ? "helpful" : "not_helpful");
    const field = helpful ? "helpful_count" : "not_helpful_count";
    await supabase
      .from("kb_articles")
      .update({ [field]: ((article as any)[field] ?? 0) + 1 })
      .eq("id", article.id);
    toast.success("Thanks for your feedback");
  };

  if (!article) {
    return <AppLayout title="Article"><div className="text-muted-foreground">Loading…</div></AppLayout>;
  }

  return (
    <AppLayout title={article.title} subtitle="Knowledgebase article">
      <div className="space-y-4 max-w-4xl">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/knowledgebase")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Knowledgebase
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{article.title}</h1>
              {article.summary && <p className="mt-2 text-muted-foreground">{article.summary}</p>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={article.status === "published" ? "default" : "outline"}>
                {article.status}
              </Badge>
              {article.visibility === "public" && <Badge variant="secondary">Public</Badge>}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {article.category && <Badge variant="outline">{article.category}</Badge>}
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {article.view_count ?? 0} views</span>
            <span>Updated {format(new Date(article.updated_at), "PPP")}</span>
            {article.embedding_status === "indexed" && (
              <span className="flex items-center gap-1 text-primary">
                <Sparkles className="h-3 w-3" /> AI-indexed
              </span>
            )}
          </div>

          <div className="border-t pt-4">
            <Markdown content={article.body || "*No content.*"} />
          </div>

          <div className="border-t pt-4 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Was this article helpful?</span>
            <Button
              variant={feedback === "helpful" ? "default" : "outline"}
              size="sm"
              onClick={() => submitFeedback(true)}
              disabled={!!feedback}
            >
              <ThumbsUp className="h-3 w-3 mr-1" /> Yes ({article.helpful_count ?? 0})
            </Button>
            <Button
              variant={feedback === "not_helpful" ? "default" : "outline"}
              size="sm"
              onClick={() => submitFeedback(false)}
              disabled={!!feedback}
            >
              <ThumbsDown className="h-3 w-3 mr-1" /> No ({article.not_helpful_count ?? 0})
            </Button>
          </div>
        </Card>

        {feedback === "not_helpful" && (
          <Card className="p-4 bg-muted/30">
            <p className="text-sm">
              Sorry this didn't help. <Link to="/portal/new" className="text-primary underline">Open a support ticket</Link> and our team will assist.
            </p>
          </Card>
        )}
      </div>

      <KBArticleDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        article={article}
        onSaved={() => refetch()}
      />
    </AppLayout>
  );
}

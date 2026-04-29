import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ThumbsUp, ThumbsDown, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export default function PortalKBArticle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [voted, setVoted] = useState<"up" | "down" | null>(null);

  const { data: article, isLoading } = useQuery({
    queryKey: ["portal-kb-article", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("kb_articles")
        .select("*")
        .eq("id", id!)
        .eq("status", "published")
        .maybeSingle();
      return data;
    },
  });

  // Increment view count once on load
  useEffect(() => {
    if (!article) return;
    supabase
      .from("kb_articles")
      .update({ view_count: (article.view_count ?? 0) + 1 })
      .eq("id", article.id)
      .then(() => {});
  }, [article?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const vote = async (kind: "up" | "down") => {
    if (!article || voted) return;
    const field = kind === "up" ? "helpful_count" : "not_helpful_count";
    const current = (article as any)[field] ?? 0;
    const { error } = await supabase
      .from("kb_articles")
      .update({ [field]: current + 1 })
      .eq("id", article.id);
    if (error) {
      toast.error("Couldn't record your feedback");
      return;
    }
    setVoted(kind);
    toast.success("Thanks for your feedback!");
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!article) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Article not found.</p>
        <Link to="/portal/kb">
          <Button variant="link">Back to KB</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/portal/kb")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Knowledge Base
      </Button>

      <Card className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{article.title}</h1>
          {article.summary && (
            <p className="text-muted-foreground mt-1">{article.summary}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {article.category && <Badge variant="secondary">{article.category}</Badge>}
            {(article.tags ?? []).map((t: string) => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
        </div>

        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
          {article.body}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Was this article helpful?</div>
            <div className="text-xs text-muted-foreground">
              {article.helpful_count ?? 0} found this helpful
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={voted === "up" ? "default" : "outline"}
              size="sm"
              onClick={() => vote("up")}
              disabled={!!voted}
            >
              <ThumbsUp className="h-4 w-4 mr-2" /> Yes
            </Button>
            <Button
              variant={voted === "down" ? "default" : "outline"}
              size="sm"
              onClick={() => vote("down")}
              disabled={!!voted}
            >
              <ThumbsDown className="h-4 w-4 mr-2" /> No
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 flex items-center justify-between">
        <div className="text-sm">
          Still need help? Submit a request and our team will get back to you.
        </div>
        <Link to="/portal/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Request</Button>
        </Link>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Loader2, Sparkles, Send, ThumbsUp, ThumbsDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ui/markdown";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface KBArticleResult {
  id: string;
  source?: "kb" | "lms";
  href?: string;
  title: string;
  summary: string | null;
  category: string | null;
  similarity: number;
}

interface KBSearchResponse {
  answer: string;
  articles: KBArticleResult[];
  search_log_id?: string;
}

interface Props {
  surface?: "portal" | "agent" | "ticket_create" | "standalone";
  ticketId?: string;
  placeholder?: string;
  compact?: boolean;
  initialQuery?: string;
}

export function KBAssistant({
  surface = "portal",
  ticketId,
  placeholder = "Describe your issue or ask a question…",
  compact = false,
  initialQuery = "",
}: Props) {
  const { currentOrganization } = useOrganization();
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KBSearchResponse | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);

  const runSearch = async (q: string) => {
    if (!q.trim() || !currentOrganization?.id) return;
    setLoading(true);
    setFeedbackGiven(null);
    try {
      const { data, error } = await supabase.functions.invoke("kb-search", {
        body: {
          query: q.trim(),
          organization_id: currentOrganization.id,
          surface,
          ticket_id: ticketId,
        },
      });
      if (error) throw new Error(error.message);
      setResult(data as KBSearchResponse);
    } catch (e: any) {
      toast.error(e.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (helpful: boolean) => {
    setFeedbackGiven(helpful);
    if (!currentOrganization?.id) return;
    // Update most recent search row from this user/query — simple best-effort update
    await supabase
      .from("kb_search_log")
      .update({ was_helpful: helpful })
      .eq("organization_id", currentOrganization.id)
      .eq("query", query.trim())
      .order("created_at", { ascending: false })
      .limit(1);
  };

  return (
    <Card className={compact ? "border-primary/20" : "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Knowledgebase Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          className="flex gap-2"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Searching knowledgebase…
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {result.answer ? (
              <div className="rounded-md border bg-card p-4">
                <Markdown content={result.answer} />
                {feedbackGiven === null ? (
                  <div className="mt-3 flex items-center gap-2 border-t pt-3">
                    <span className="text-xs text-muted-foreground mr-2">Was this helpful?</span>
                    <Button size="sm" variant="ghost" onClick={() => submitFeedback(true)}>
                      <ThumbsUp className="h-3 w-3 mr-1" /> Yes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => submitFeedback(false)}>
                      <ThumbsDown className="h-3 w-3 mr-1" /> No
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground border-t pt-3">
                    Thanks for the feedback.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No matching articles found. Try rephrasing, or open a support ticket.
              </div>
            )}

            {result.articles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Sources
                </p>
                {result.articles.map((a, i) => (
                  <Link
                    key={`${a.source ?? "kb"}:${a.id}`}
                    to={a.href ?? `/knowledgebase/${a.id}`}
                    className="block rounded-md border p-3 hover:bg-accent/40 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">[{i + 1}]</span>
                          <p className="font-medium text-sm truncate">{a.title}</p>
                          {a.source === "lms" && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Course</Badge>
                          )}
                        </div>
                        {a.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{a.summary}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {a.category && <Badge variant="outline" className="text-xs">{a.category}</Badge>}
                          <span className="text-xs text-muted-foreground">
                            {Math.round(a.similarity * 100)}% match
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

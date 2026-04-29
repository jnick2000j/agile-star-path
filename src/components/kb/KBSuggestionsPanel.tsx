import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, BookOpen, ExternalLink, ThumbsUp, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

interface Suggestion {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  category: string | null;
  tags: string[] | null;
  helpful_count: number;
  view_count: number;
}

interface Props {
  organizationId: string;
  query: string;             // subject + description (or partial reply text)
  ticketId?: string;
  context?: "agent_reply" | "ticket_create" | "search";
  /** debounce delay before auto-fetching (ms). 0 = manual only */
  autoFetchMs?: number;
  /** route prefix for KB article links */
  articleHref?: (s: Suggestion) => string;
  /** called when an article is inserted into a reply */
  onInsert?: (s: Suggestion) => void;
}

export function KBSuggestionsPanel({
  organizationId,
  query,
  ticketId,
  context = "agent_reply",
  autoFetchMs = 1500,
  articleHref,
  onInsert,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const fetchSuggestions = async () => {
    if (!query || query.trim().length < 10 || !organizationId) return;
    setLoading(true);
    setError(null);
    const { data, error: invErr } = await supabase.functions.invoke("kb-ai-suggest", {
      body: { organization_id: organizationId, query, ticket_id: ticketId, context },
    });
    setLoading(false);
    setHasFetched(true);
    if (invErr) {
      setError(invErr.message || "Failed to load suggestions");
      return;
    }
    if ((data as any)?.error) {
      setError((data as any).error);
      return;
    }
    setSuggestions((data as any).suggestions || []);
    setKeywords((data as any).keywords || []);
  };

  // Auto-fetch with debounce
  useEffect(() => {
    if (!autoFetchMs) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(fetchSuggestions, autoFetchMs);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, organizationId]);

  const hrefFor = (s: Suggestion) => articleHref?.(s) ?? `/help/article/${s.slug}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-Suggested Articles
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchSuggestions} disabled={loading || !query}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {keywords.map((k) => (
              <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && !suggestions.length && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Analyzing query...
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!loading && hasFetched && !suggestions.length && !error && (
          <p className="text-xs text-muted-foreground">
            No matching articles found. Try rephrasing or browse the knowledge base.
          </p>
        )}
        {suggestions.map((s) => (
          <div key={s.id} className="border rounded-md p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link to={hrefFor(s)} className="font-medium text-sm hover:text-primary flex items-center gap-1 group">
                  <BookOpen className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{s.title}</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                </Link>
                {s.summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.summary}</p>
                )}
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {s.category && <span>{s.category}</span>}
                  {s.helpful_count > 0 && (
                    <span className="flex items-center gap-0.5">
                      <ThumbsUp className="h-3 w-3" />{s.helpful_count}
                    </span>
                  )}
                  <span>{s.view_count} views</span>
                </div>
              </div>
              {onInsert && (
                <Button size="sm" variant="outline" onClick={() => onInsert(s)} className="text-xs h-7">
                  Insert
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

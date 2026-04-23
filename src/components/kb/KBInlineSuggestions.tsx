// Inline KB suggestions while drafting a ticket. Debounced.
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Link } from "react-router-dom";

interface Suggestion {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  similarity: number;
}

interface Props {
  subject: string;
  description?: string;
}

export function KBInlineSuggestions({ subject, description }: Props) {
  const { currentOrganization } = useOrganization();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const text = (subject || "").trim();
    if (text.length < 8 || !currentOrganization?.id) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("kb-suggest-for-ticket", {
          body: {
            subject: text,
            description: description ?? "",
            organization_id: currentOrganization.id,
          },
        });
        if (!error && data?.articles) setSuggestions(data.articles);
        setSearched(true);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [subject, description, currentOrganization?.id]);

  if (!searched && !loading) return null;

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        AI suggestions
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      {suggestions.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Lightbulb className="h-3 w-3" />
          No matching articles. Continue submitting your ticket.
        </p>
      )}
      {suggestions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          These articles may answer your question — saving you time:
        </p>
      )}
      <div className="space-y-1">
        {suggestions.map((s) => (
          <Link
            key={s.id}
            to={`/knowledgebase/${s.id}`}
            target="_blank"
            className="block rounded border bg-background p-2 hover:bg-accent/40 transition"
          >
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium flex-1 truncate">{s.title}</p>
              {s.category && <Badge variant="outline" className="text-xs">{s.category}</Badge>}
              <span className="text-xs text-muted-foreground">
                {Math.round(s.similarity * 100)}%
              </span>
            </div>
            {s.summary && <p className="text-xs text-muted-foreground line-clamp-1">{s.summary}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}

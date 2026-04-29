import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Search, BookOpen, ArrowRight } from "lucide-react";

export default function PortalKB() {
  const { currentOrganization } = useOrganization();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["portal-kb-articles", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("kb_articles")
        .select("id, title, summary, category, tags, view_count, helpful_count")
        .eq("organization_id", currentOrganization!.id)
        .eq("status", "published")
        .order("view_count", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of articles as any[]) if (a.category) set.add(a.category);
    return Array.from(set).sort();
  }, [articles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (articles as any[]).filter((a) => {
      if (activeCategory && a.category !== activeCategory) return false;
      if (!q) return true;
      return (
        a.title?.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.tags?.some((t: string) => t.toLowerCase().includes(q))
      );
    });
  }, [articles, search, activeCategory]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Knowledge Base
        </h1>
        <p className="text-sm text-muted-foreground">
          Find answers before you submit a request.
        </p>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search articles…"
            className="pl-9 h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={activeCategory === null ? "default" : "outline"}
            onClick={() => setActiveCategory(null)}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={activeCategory === c ? "default" : "outline"}
              onClick={() => setActiveCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground md:col-span-2">
            No articles found. <Link to="/portal/new" className="text-primary hover:underline">Submit a request</Link>.
          </Card>
        )}
        {filtered.map((a: any) => (
          <Link key={a.id} to={`/portal/kb/${a.id}`}>
            <Card className="p-4 hover:shadow-md transition-shadow h-full">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{a.title}</h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
              {a.summary && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.summary}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {a.category && <Badge variant="secondary">{a.category}</Badge>}
                {(a.tags ?? []).slice(0, 3).map((t: string) => (
                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {a.view_count ?? 0} views · {a.helpful_count ?? 0} helpful
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, MessageSquarePlus, Inbox, TrendingUp, ArrowRight } from "lucide-react";

export default function HelpPortal() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: popularArticles = [] } = useQuery({
    queryKey: ["help-popular-articles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("kb_articles")
        .select("id, title, summary, view_count, category, slug")
        .eq("visibility", "public")
        .eq("status", "published")
        .order("view_count", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["help-search", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const { data } = await supabase
        .from("kb_articles")
        .select("id, title, summary, category")
        .eq("visibility", "public")
        .eq("status", "published")
        .or(`title.ilike.%${search}%,summary.ilike.%${search}%`)
        .limit(8);
      return data ?? [];
    },
    enabled: search.trim().length >= 2,
  });

  const categories = Array.from(new Set(popularArticles.map((a: any) => a.category).filter(Boolean)));

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Hero */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl font-bold mb-3">How can we help?</h1>
          <p className="text-muted-foreground mb-8">Search our knowledge base or submit a request</p>
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              className="pl-12 h-14 text-base"
              placeholder="Search articles, e.g. 'reset password'"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {searchResults.length > 0 && (
            <Card className="mt-3 max-w-2xl mx-auto text-left p-2">
              {searchResults.map((a: any) => (
                <Link
                  key={a.id}
                  to={`/help/article/${a.id}`}
                  className="flex items-center justify-between p-3 rounded hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium">{a.title}</div>
                    {a.summary && <div className="text-xs text-muted-foreground line-clamp-1">{a.summary}</div>}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 cursor-pointer hover:border-primary/40 transition" onClick={() => navigate("/help/submit")}>
            <MessageSquarePlus className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Submit a Request</h3>
            <p className="text-sm text-muted-foreground">Open a new support ticket</p>
          </Card>
          <Card className="p-6 cursor-pointer hover:border-primary/40 transition" onClick={() => navigate("/help/my-tickets")}>
            <Inbox className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">My Tickets</h3>
            <p className="text-sm text-muted-foreground">Track your support requests</p>
          </Card>
          <Card className="p-6 cursor-pointer hover:border-primary/40 transition" onClick={() => navigate("/status")}>
            <TrendingUp className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Service Status</h3>
            <p className="text-sm text-muted-foreground">Check current system status</p>
          </Card>
        </div>

        {/* Popular articles */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Popular Articles
            </h2>
          </div>
          {popularArticles.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No published articles yet
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {popularArticles.map((a: any) => (
                <Card
                  key={a.id}
                  className="p-5 cursor-pointer hover:border-primary/40 transition"
                  onClick={() => navigate(`/help/article/${a.id}`)}
                >
                  <h3 className="font-medium mb-2">{a.title}</h3>
                  {a.summary && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{a.summary}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {a.category && <Badge variant="outline">{a.category}</Badge>}
                    <span>{a.view_count ?? 0} views</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Browse by Category</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((c: any) => (
                <Badge key={c} variant="secondary" className="text-sm py-1 px-3">{c}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

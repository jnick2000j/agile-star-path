import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, FileText, Upload, Sparkles, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { KBAssistant } from "@/components/kb/KBAssistant";
import { KBArticleDialog } from "@/components/kb/KBArticleDialog";
import { KBUploadDialog } from "@/components/kb/KBUploadDialog";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { format } from "date-fns";

export default function Knowledgebase() {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const { accessLevel } = useOrgAccessLevel();
  const canEdit = ["admin", "manager", "editor"].includes(accessLevel ?? "");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "archived">("published");

  const { data: articles = [], refetch } = useQuery({
    queryKey: ["kb-articles", currentOrganization?.id, statusFilter, search],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      let q = supabase
        .from("kb_articles")
        .select("id, title, summary, category, tags, status, visibility, view_count, helpful_count, updated_at, embedding_status")
        .eq("organization_id", currentOrganization.id)
        .order("updated_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const categories = Array.from(new Set(articles.map((a: any) => a.category).filter(Boolean)));

  return (
    <AppLayout title="Knowledgebase" subtitle="Find answers, share knowledge, get AI-powered help">
      <div className="space-y-6">
        <KBAssistant surface="standalone" placeholder="Ask anything — e.g. 'How do I reset my password?'" />

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Input
              placeholder="Filter articles by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            {(["all", "published", "draft", "archived"] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-1" /> Upload
                </Button>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New article
                </Button>
              </>
            )}
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {categories.map((c) => (
              <Badge key={c as string} variant="secondary">{c as string}</Badge>
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {articles.length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="py-10 text-center text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No articles yet.</p>
                {canEdit && (
                  <p className="text-xs mt-1">Create your first article or upload a document to get started.</p>
                )}
              </CardContent>
            </Card>
          )}
          {articles.map((a: any) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-primary/40 transition"
              onClick={() => navigate(`/knowledgebase/${a.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex-1">{a.title}</CardTitle>
                  <Badge variant={a.status === "published" ? "default" : "outline"} className="text-xs">
                    {a.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {a.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{a.summary}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  {a.category && <Badge variant="outline" className="text-xs">{a.category}</Badge>}
                  {a.visibility === "public" && (
                    <Badge variant="secondary" className="text-xs">Public</Badge>
                  )}
                  {a.embedding_status === "indexed" && (
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      AI-indexed
                    </span>
                  )}
                  <span>· {a.view_count ?? 0} views</span>
                  <span>· {format(new Date(a.updated_at), "MMM d")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <KBArticleDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={() => refetch()} />
      <KBUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={() => refetch()} />
    </AppLayout>
  );
}

// Create or edit a KB article (rich-text via textarea/markdown for now).
// Saves and triggers re-embedding via kb-embed.
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article?: any;
  onSaved?: () => void;
}

export function KBArticleDialog({ open, onOpenChange, article, onSaved }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    body: "",
    category: "",
    tags: "",
    status: "draft" as "draft" | "published" | "archived",
    visibility: "internal" as "internal" | "public",
  });

  useEffect(() => {
    if (open && article) {
      setForm({
        title: article.title ?? "",
        summary: article.summary ?? "",
        body: article.body ?? "",
        category: article.category ?? "",
        tags: (article.tags ?? []).join(", "),
        status: article.status ?? "draft",
        visibility: article.visibility ?? "internal",
      });
    } else if (open && !article) {
      setForm({
        title: "", summary: "", body: "", category: "", tags: "",
        status: "draft", visibility: "internal",
      });
    }
  }, [open, article]);

  const handleSave = async () => {
    if (!currentOrganization?.id || !form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        organization_id: currentOrganization.id,
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        body: form.body,
        category: form.category.trim() || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        status: form.status,
        visibility: form.visibility,
        last_edited_by: user?.id ?? null,
        published_at: form.status === "published" ? new Date().toISOString() : null,
        embedding_status: "pending",
      };

      let savedId: string;
      if (article?.id) {
        const { error } = await supabase
          .from("kb_articles")
          .update(payload)
          .eq("id", article.id);
        if (error) throw error;
        savedId = article.id;
      } else {
        const { data, error } = await supabase
          .from("kb_articles")
          .insert({ ...payload, author_user_id: user?.id ?? null, source: "authored" })
          .select()
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      toast.success(article ? "Article updated" : "Article created");

      // Fire-and-forget re-embed (no await UI block)
      supabase.functions.invoke("kb-embed", { body: { article_id: savedId } })
        .then(({ error }) => {
          if (error) console.warn("Embedding failed:", error.message);
        });

      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error("Failed to save: " + (e.message ?? "unknown"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? "Edit article" : "New knowledgebase article"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Summary</Label>
            <Input
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="One-line summary shown in search results"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Account, Billing, How-to"
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="login, password, sso"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Body (Markdown supported)</Label>
            <Textarea
              rows={14}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder={"# Heading\n\nWrite your article in **markdown**. Use lists, code blocks, and links.\n\n- Step 1\n- Step 2"}
              className="font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={(v: any) => setForm({ ...form, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal (org members)</SelectItem>
                  <SelectItem value="public">Public (also stakeholders)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            On save, the article is automatically indexed for AI semantic search.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> : "Save article"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

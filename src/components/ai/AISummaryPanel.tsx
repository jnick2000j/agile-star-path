import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Loader2, AlertCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Kind = "entity_overview" | "weekly_status" | "risk_issue_digest" | "stakeholder_exec";

interface Props {
  scopeType: "programme" | "project" | "product" | "portfolio";
  scopeId: string;
  summaryKind?: Kind;
  title?: string;
  description?: string;
}

interface SummaryRow {
  id: string;
  status: string;
  is_stale: boolean;
  draft_content: { content?: string } | null;
  published_content: { content?: string } | null;
  generated_at: string | null;
  approved_at: string | null;
}

export function AISummaryPanel({
  scopeType,
  scopeId,
  summaryKind = "entity_overview",
  title = "AI Summary",
  description = "An AI-generated overview based on the latest data. Requires human approval before publishing.",
}: Props) {
  const { currentOrganization } = useOrganization();
  const [row, setRow] = useState<SummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchRow = async () => {
    if (!scopeId) return;
    setLoading(true);
    const { data } = await supabase
      .from("ai_summaries")
      .select("id,status,is_stale,draft_content,published_content,generated_at,approved_at")
      .eq("scope_type", scopeType)
      .eq("scope_id", scopeId)
      .eq("summary_kind", summaryKind)
      .maybeSingle();
    setRow((data as SummaryRow | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    fetchRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeType, scopeId, summaryKind]);

  const generate = async () => {
    if (!currentOrganization?.id) {
      toast.error("Pick an organization first.");
      return;
    }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("ai-summarize", {
      body: {
        scope_type: scopeType,
        scope_id: scopeId,
        organization_id: currentOrganization.id,
        summary_kind: summaryKind,
        require_approval: true,
      },
    });
    setGenerating(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Couldn't generate summary.");
      return;
    }
    toast.success("Summary drafted — pending approval in /ai-approvals.");
    fetchRow();
  };

  const published = row?.published_content?.content;
  const draft = row?.draft_content?.content;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              {title}
              {row?.is_stale && (
                <Badge variant="outline" className="text-xs gap-1">
                  <AlertCircle className="h-3 w-3" /> Stale
                </Badge>
              )}
              {row?.status === "pending" && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Clock className="h-3 w-3" /> Pending approval
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5">{published || draft ? "Refresh" : "Generate"}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : published ? (
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {published}
            {row?.approved_at && (
              <p className="text-xs text-muted-foreground mt-3 not-prose">
                Approved {formatDistanceToNow(new Date(row.approved_at), { addSuffix: true })}
              </p>
            )}
          </div>
        ) : draft ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground italic">
              Draft awaiting approval — go to AI Approvals to review.
            </p>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap opacity-70">
              {draft}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            No summary yet. Click <strong>Generate</strong> to draft one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

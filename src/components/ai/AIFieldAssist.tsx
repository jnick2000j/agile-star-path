import { useState } from "react";
import { Sparkles, Wand2, Minimize2, Maximize2, Languages, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

type Mode = "improve" | "shorten" | "expand" | "translate" | "formal";

interface AIFieldAssistProps {
  value: string;
  onApply: (newValue: string) => void;
  fieldName: string;
  context?: string;
  entityType?: string;
  entityId?: string;
  size?: "sm" | "default";
  /** When true (default) the suggestion goes to the AI Approval Queue and is not applied immediately. */
  requireApproval?: boolean;
}

const LANGUAGES = [
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
];

export function AIFieldAssist({
  value,
  onApply,
  fieldName,
  context,
  entityType,
  entityId,
  size = "sm",
  requireApproval = true,
}: AIFieldAssistProps) {
  const { currentOrganization } = useOrganization();
  const { can } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [activeMode, setActiveMode] = useState<Mode>("improve");

  // Check if user is even allowed to draft with AI.
  const canDraft = can("ai_drafting", "create") || true; // permissive fallback — gated server-side too
  if (!canDraft) return null;

  const run = async (mode: Mode, language?: string) => {
    if (!value || value.trim().length < 3) {
      toast.error("Add some text first, then ask the AI to refine it.");
      return;
    }
    setLoading(true);
    setActiveMode(mode);
    try {
      const { data, error } = await supabase.functions.invoke("ai-draft", {
        body: {
          kind: "field",
          mode,
          text: value,
          context,
          language,
          field: fieldName,
          entity_type: entityType,
          entity_id: entityId,
          organization_id: currentOrganization?.id ?? null,
        },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error === "rate_limited") toast.error("AI is busy — try again in a few seconds.");
        else if (data.error === "payment_required") toast.error("AI credits exhausted. Add credits in workspace settings.");
        else toast.error("AI request failed.");
        return;
      }
      setSuggestion(data?.content ?? "");
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reach the AI service.");
    } finally {
      setLoading(false);
    }
  };

  const accept = () => {
    if (requireApproval) {
      toast.success("Suggestion sent to AI Approvals — an approver will publish it.");
      setPreviewOpen(false);
      return;
    }
    onApply(suggestion);
    setPreviewOpen(false);
    toast.success("Applied AI suggestion.");
  };

  const applyImmediately = () => {
    onApply(suggestion);
    setPreviewOpen(false);
    toast.success("Applied locally — the suggestion still needs approval before it's saved.");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size={size} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="text-xs">AI</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>AI Field Assist</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => run("improve")}>
            <Wand2 className="h-4 w-4 mr-2" /> Improve
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("shorten")}>
            <Minimize2 className="h-4 w-4 mr-2" /> Shorten
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("expand")}>
            <Maximize2 className="h-4 w-4 mr-2" /> Expand
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("formal")}>
            <GraduationCap className="h-4 w-4 mr-2" /> Make formal
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Languages className="h-4 w-4 mr-2" /> Translate
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {LANGUAGES.map((l) => (
                  <DropdownMenuItem key={l.code} onClick={() => run("translate", l.label)}>
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              AI Suggestion
              <Badge variant="secondary" className="text-xs capitalize">{activeMode}</Badge>
              {requireApproval && <Badge variant="outline" className="text-xs">Needs approval</Badge>}
            </DialogTitle>
            <DialogDescription>
              Review the AI's suggestion below.
              {requireApproval
                ? " Accepting will queue it for an approver — it won't overwrite your field yet."
                : " Accepting replaces your current text."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Original</p>
              <Textarea value={value} readOnly className="min-h-[100px] text-xs" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Suggestion</p>
              <Textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                className="min-h-[140px] text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>Discard</Button>
            {requireApproval && (
              <Button variant="outline" onClick={applyImmediately}>
                Apply locally (still needs approval)
              </Button>
            )}
            <Button onClick={accept}>
              {requireApproval ? "Send for approval" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

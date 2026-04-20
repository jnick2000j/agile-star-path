import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export type WizardKind =
  | "project_brief"
  | "pid"
  | "programme_mandate"
  | "benefit_profile"
  | "change_request"
  | "exception_report"
  | "user_story"
  | "status_update"
  | "risk_suggestions"
  | "issue_suggestions";

export interface WizardField {
  key: string;
  label: string;
  type?: "text" | "textarea";
  placeholder?: string;
  required?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wizard: WizardKind;
  title: string;
  description: string;
  fields: WizardField[];
  entityType?: string;
  entityId?: string;
  /** Optional: called when the user accepts the draft (only fires if requireApproval=false). */
  onAccept?: (content: string) => void;
}

export function AIDraftWizardDialog({
  open,
  onOpenChange,
  wizard,
  title,
  description,
  fields,
  entityType,
  entityId,
  onAccept,
}: Props) {
  const { currentOrganization } = useOrganization();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string>("");

  const generate = async () => {
    const missing = fields.filter((f) => f.required && !inputs[f.key]?.trim());
    if (missing.length) {
      toast.error(`Fill in: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-draft", {
        body: {
          kind: "wizard",
          wizard,
          inputs,
          entity_type: entityType,
          entity_id: entityId,
          organization_id: currentOrganization?.id ?? null,
        },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error === "rate_limited") toast.error("AI is busy — try again shortly.");
        else if (data.error === "payment_required") toast.error("AI credits exhausted.");
        else toast.error("Draft generation failed.");
        return;
      }
      setDraft(data?.content ?? "");
      toast.success("Draft generated — sent to AI Approvals.");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reach the AI service.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setInputs({});
    setDraft("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {title}
            <Badge variant="outline" className="text-xs">Needs approval</Badge>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          {!draft ? (
            <div className="space-y-4 py-2">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label>
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  {f.type === "textarea" ? (
                    <Textarea
                      value={inputs[f.key] ?? ""}
                      onChange={(e) => setInputs({ ...inputs, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="min-h-[80px]"
                    />
                  ) : (
                    <Input
                      value={inputs[f.key] ?? ""}
                      onChange={(e) => setInputs({ ...inputs, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 py-2">
              <p className="text-xs text-muted-foreground">
                The full draft has been logged in <strong>AI Approvals</strong>. An approver will review and publish.
              </p>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[400px] font-mono text-xs"
              />
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          {!draft ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={generate} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Draft
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={reset}>Start over</Button>
              {onAccept && (
                <Button variant="outline" onClick={() => { onAccept(draft); onOpenChange(false); }}>
                  Use locally
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

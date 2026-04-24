import { useState } from "react";
import { Sparkles, Loader2, Wand2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { notifyAiCreditsChanged } from "@/components/billing/AICreditsMeter";
import { toast } from "sonner";

interface TriageDraft {
  subject: string;
  description: string;
  ticket_type: "incident" | "service_request" | "question" | "problem";
  priority: "low" | "medium" | "high" | "urgent";
  priority_rationale?: string;
  category?: string;
  suggested_assignee_group?: string;
  sla_response_minutes?: number;
  sla_resolution_minutes?: number;
  sla_rationale?: string;
  affected_users_estimate?: string;
  initial_diagnosis_hypothesis?: string;
  recommended_first_actions?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (ticketId: string) => void;
}

const TYPE_OPTIONS = ["incident", "service_request", "question", "problem"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-success/10 text-success",
};

function formatMinutes(m?: number): string {
  if (!m && m !== 0) return "—";
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = m / 60;
    return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`;
  }
  const d = m / 1440;
  return Number.isInteger(d) ? `${d} d` : `${d.toFixed(1)} d`;
}

export function IncidentTriageWizard({ open, onOpenChange, onCreated }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rawMessage, setRawMessage] = useState("");
  const [serviceContext, setServiceContext] = useState("");
  const [reporter, setReporter] = useState("");
  const [draft, setDraft] = useState<TriageDraft | null>(null);

  const reset = () => {
    setDraft(null);
    setRawMessage("");
    setServiceContext("");
    setReporter("");
  };

  const generate = async () => {
    if (!rawMessage.trim()) {
      toast.error("Paste the user's raw message first");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-draft", {
        body: {
          kind: "wizard",
          wizard: "hd_ticket_triage",
          inputs: {
            raw_message: rawMessage,
            service_context: serviceContext || undefined,
            reporter: reporter || undefined,
          },
          organization_id: currentOrganization?.id ?? null,
        },
      });
      if (error) {
        const ctx = (error as any)?.context;
        const code = ctx?.body?.code ?? ctx?.code;
        const msg = ctx?.body?.error ?? error.message;
        if (code === "credits_exhausted") toast.error(msg ?? "AI credit allowance reached.");
        else if (code === "residency_blocked") toast.error(msg ?? "Blocked by data-residency policy.");
        else toast.error(msg ?? "Triage failed.");
        return;
      }
      const raw = data?.content ?? "";
      const cleaned = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: TriageDraft | null = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        toast.error("AI returned an invalid format — try again.");
        return;
      }
      // Sane defaults
      if (parsed) {
        if (!PRIORITY_OPTIONS.includes(parsed.priority)) parsed.priority = "medium";
        if (!TYPE_OPTIONS.includes(parsed.ticket_type)) parsed.ticket_type = "incident";
      }
      setDraft(parsed);
      notifyAiCreditsChanged();
      toast.success("Triage draft ready — review and create the ticket.");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reach the AI service.");
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = <K extends keyof TriageDraft>(k: K, v: TriageDraft[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  };

  const createTicket = async () => {
    if (!draft || !currentOrganization?.id) return;
    if (!draft.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setCreating(true);
    const dueAt = (mins?: number) =>
      mins ? new Date(Date.now() + mins * 60_000).toISOString() : null;

    // Append AI rationale into description for transparency.
    const fullDescription = [
      draft.description?.trim() || "",
      "",
      "— AI Triage Notes —",
      draft.priority_rationale ? `Priority rationale: ${draft.priority_rationale}` : "",
      draft.sla_rationale ? `SLA rationale: ${draft.sla_rationale}` : "",
      draft.affected_users_estimate ? `Affected users: ${draft.affected_users_estimate}` : "",
      draft.suggested_assignee_group
        ? `Suggested assignee group: ${draft.suggested_assignee_group}`
        : "",
      draft.initial_diagnosis_hypothesis
        ? `Initial diagnosis: ${draft.initial_diagnosis_hypothesis}`
        : "",
      draft.recommended_first_actions?.length
        ? `Recommended first actions:\n${draft.recommended_first_actions.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { data: created, error } = await supabase
      .from("helpdesk_tickets")
      .insert({
        organization_id: currentOrganization.id,
        subject: draft.subject.trim().slice(0, 250),
        description: fullDescription,
        ticket_type: draft.ticket_type as any,
        priority: draft.priority as any,
        category: draft.category?.trim() || null,
        reporter_user_id: user?.id ?? null,
        reporter_email: user?.email ?? null,
        reporter_name: reporter || null,
        created_by: user?.id ?? null,
        source: "internal" as any,
        sla_response_due_at: dueAt(draft.sla_response_minutes),
        sla_resolution_due_at: dueAt(draft.sla_resolution_minutes),
        metadata: {
          triage: {
            generated_by: "hd_ticket_triage",
            sla_response_minutes: draft.sla_response_minutes ?? null,
            sla_resolution_minutes: draft.sla_resolution_minutes ?? null,
            suggested_assignee_group: draft.suggested_assignee_group ?? null,
          },
        },
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !created) {
      toast.error("Failed to create ticket: " + (error?.message ?? "unknown"));
      return;
    }
    toast.success("Ticket created from triage draft");
    onCreated?.(created.id);
    onOpenChange(false);
    reset();
    navigate(`/support/tickets/${created.id}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Triage user message into a ticket
            <Badge variant="outline" className="text-xs">
              AI-assisted
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Paste a raw user report — email, chat or call notes — and the AI will calculate
            priority, suggest a category and propose initial SLA targets. Edit anything before
            creating the ticket.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          {!draft ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>
                  Raw user message <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  rows={8}
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
                  placeholder={`e.g.\n"Hi, since this morning I can't access Salesforce. Page just spins. Three of us in the EMEA team are blocked — can someone help urgently? Thanks, Maria"`}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Reporter (optional)</Label>
                  <Input
                    value={reporter}
                    onChange={(e) => setReporter(e.target.value)}
                    placeholder="Name or team"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Service context (optional)</Label>
                  <Input
                    value={serviceContext}
                    onChange={(e) => setServiceContext(e.target.value)}
                    placeholder="e.g. coverage 9-5 weekdays, vendor SLA 4h"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-semibold text-sm">Ticket draft</h4>
                  <div className="flex items-center gap-2">
                    <Badge className={PRIORITY_TONE[draft.priority]}>
                      {draft.priority.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">{draft.ticket_type.replace(/_/g, " ")}</Badge>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Subject</Label>
                  <Input
                    value={draft.subject}
                    onChange={(e) => updateDraft("subject", e.target.value)}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={draft.ticket_type}
                      onValueChange={(v) => updateDraft("ticket_type", v as TriageDraft["ticket_type"])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Priority</Label>
                    <Select
                      value={draft.priority}
                      onValueChange={(v) => updateDraft("priority", v as TriageDraft["priority"])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Input
                      value={draft.category ?? ""}
                      onChange={(e) => updateDraft("category", e.target.value)}
                      placeholder="e.g. Access"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Description (added to ticket)</Label>
                  <Textarea
                    rows={5}
                    value={draft.description}
                    onChange={(e) => updateDraft("description", e.target.value)}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Initial SLA — response (mins)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={draft.sla_response_minutes ?? ""}
                      onChange={(e) =>
                        updateDraft(
                          "sla_response_minutes",
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      = {formatMinutes(draft.sla_response_minutes)}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Initial SLA — resolution (mins)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={draft.sla_resolution_minutes ?? ""}
                      onChange={(e) =>
                        updateDraft(
                          "sla_resolution_minutes",
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      = {formatMinutes(draft.sla_resolution_minutes)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Suggested assignee group</Label>
                  <Input
                    value={draft.suggested_assignee_group ?? ""}
                    onChange={(e) => updateDraft("suggested_assignee_group", e.target.value)}
                  />
                </div>
              </Card>

              <Card className="p-4 space-y-2 bg-muted/30">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Triage notes (saved with ticket)
                </h4>
                {draft.priority_rationale && (
                  <p className="text-xs">
                    <span className="font-medium">Priority:</span> {draft.priority_rationale}
                  </p>
                )}
                {draft.sla_rationale && (
                  <p className="text-xs">
                    <span className="font-medium">SLA:</span> {draft.sla_rationale}
                  </p>
                )}
                {draft.affected_users_estimate && (
                  <p className="text-xs">
                    <span className="font-medium">Affected users:</span>{" "}
                    {draft.affected_users_estimate}
                  </p>
                )}
                {draft.initial_diagnosis_hypothesis && (
                  <p className="text-xs">
                    <span className="font-medium">Initial diagnosis:</span>{" "}
                    {draft.initial_diagnosis_hypothesis}
                  </p>
                )}
                {!!draft.recommended_first_actions?.length && (
                  <div className="text-xs">
                    <p className="font-medium mb-1">Recommended first actions:</p>
                    <ol className="list-decimal pl-5 space-y-0.5">
                      {draft.recommended_first_actions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </Card>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          {!draft ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={generate} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Triage with AI
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Back to input
              </Button>
              <Button onClick={createTicket} disabled={creating}>
                <Plus className="h-4 w-4 mr-2" />
                {creating ? "Creating…" : "Create ticket"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

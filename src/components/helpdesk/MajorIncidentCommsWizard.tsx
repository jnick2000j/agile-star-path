import { useState } from "react";
import { Sparkles, Loader2, Megaphone, Copy, Check } from "lucide-react";
import { format } from "date-fns";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { notifyAiCreditsChanged } from "@/components/billing/AICreditsMeter";
import { toast } from "sonner";

interface CommsMessage {
  audience: string;
  channel: string;
  timestamp_label: string;
  subject: string;
  body: string;
}

interface CommsPack {
  initial?: CommsMessage;
  status_update?: CommsMessage;
  executive_summary?: CommsMessage;
  post_incident?: CommsMessage;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional: pre-populate from a ticket. */
  ticket?: {
    id?: string;
    subject?: string | null;
    description?: string | null;
    reference_number?: string | null;
    organization_id?: string;
  } | null;
}

const SLOTS: { key: keyof CommsPack; label: string; tone: string }[] = [
  { key: "initial", label: "Initial customer notification", tone: "bg-info/10 text-info border-info/30" },
  { key: "status_update", label: "Status update (in-flight)", tone: "bg-warning/10 text-warning border-warning/30" },
  { key: "executive_summary", label: "Executive summary", tone: "bg-primary/10 text-primary border-primary/30" },
  { key: "post_incident", label: "Post-incident message", tone: "bg-success/10 text-success border-success/30" },
];

export function MajorIncidentCommsWizard({ open, onOpenChange, ticket }: Props) {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pack, setPack] = useState<CommsPack | null>(null);
  const [inputs, setInputs] = useState({
    service: "",
    impact: "",
    what_we_know: "",
    incident_started_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    next_update_in: "30 minutes",
    incident_commander: "",
    eta_to_mitigate: "",
    related_ticket: ticket?.reference_number ?? "",
    incident_summary_for_post: "",
  });

  const update = (k: keyof typeof inputs, v: string) => setInputs((p) => ({ ...p, [k]: v }));

  const generate = async () => {
    if (!inputs.service.trim() || !inputs.impact.trim() || !inputs.what_we_know.trim()) {
      toast.error("Fill in service, impact and what you currently know");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-draft", {
        body: {
          kind: "wizard",
          wizard: "hd_major_incident_pack",
          inputs,
          entity_type: ticket?.id ? "helpdesk_ticket" : undefined,
          entity_id: ticket?.id,
          organization_id: currentOrganization?.id ?? ticket?.organization_id ?? null,
        },
      });
      if (error) {
        const ctx = (error as any)?.context;
        const code = ctx?.body?.code ?? ctx?.code;
        const msg = ctx?.body?.error ?? error.message;
        if (code === "credits_exhausted") toast.error(msg ?? "AI credit allowance reached.");
        else if (code === "residency_blocked") toast.error(msg ?? "Blocked by data-residency policy.");
        else toast.error(msg ?? "Failed to generate comms pack.");
        return;
      }
      const raw = data?.content ?? "";
      // Strip ```json fences if present
      const cleaned = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: CommsPack | null = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        toast.error("AI returned an invalid format — try again.");
        return;
      }
      setPack(parsed);
      notifyAiCreditsChanged();
      toast.success("Comms pack drafted — review each message before sending.");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reach the AI service.");
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = async (key: string, msg: CommsMessage) => {
    const text = `Subject: ${msg.subject}\n\n${msg.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const updateMessage = (key: keyof CommsPack, field: "subject" | "body", value: string) => {
    setPack((p) => (p ? { ...p, [key]: { ...(p[key] as CommsMessage), [field]: value } } : p));
  };

  const reset = () => {
    setPack(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Major Incident Comms Pack
            <Badge variant="outline" className="text-xs">
              Timeline-coordinated
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Generates four coordinated messages — initial notification, status update, executive
            summary, and post-incident message — anchored to the incident timeline you provide.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          {!pack ? (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    Affected service <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={inputs.service}
                    onChange={(e) => update("service", e.target.value)}
                    placeholder="e.g. Payment gateway, Customer portal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Incident started at</Label>
                  <Input
                    type="datetime-local"
                    value={inputs.incident_started_at}
                    onChange={(e) => update("incident_started_at", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Customer impact <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  rows={3}
                  value={inputs.impact}
                  onChange={(e) => update("impact", e.target.value)}
                  placeholder="What can customers not do right now? Estimate scope (all / region / segment)."
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  What we currently know <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  rows={4}
                  value={inputs.what_we_know}
                  onChange={(e) => update("what_we_know", e.target.value)}
                  placeholder="Symptoms observed, systems implicated, latest investigation findings."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Next update in</Label>
                  <Input
                    value={inputs.next_update_in}
                    onChange={(e) => update("next_update_in", e.target.value)}
                    placeholder="e.g. 30 minutes"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ETA to mitigate</Label>
                  <Input
                    value={inputs.eta_to_mitigate}
                    onChange={(e) => update("eta_to_mitigate", e.target.value)}
                    placeholder="e.g. ~1 hour, unknown"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Incident commander</Label>
                  <Input
                    value={inputs.incident_commander}
                    onChange={(e) => update("incident_commander", e.target.value)}
                    placeholder="Name / role"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Related ticket reference</Label>
                  <Input
                    value={inputs.related_ticket}
                    onChange={(e) => update("related_ticket", e.target.value)}
                    placeholder="e.g. INC-1234"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Post-incident summary (optional)</Label>
                  <Input
                    value={inputs.incident_summary_for_post}
                    onChange={(e) => update("incident_summary_for_post", e.target.value)}
                    placeholder="One line for the post-mortem message"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">
                Each message is editable — fine-tune wording before sending. Copy the one you need.
              </p>
              {SLOTS.map(({ key, label, tone }) => {
                const m = pack[key];
                if (!m) return null;
                const copied = copiedKey === key;
                return (
                  <Card key={key} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={tone}>
                            {label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {m.timestamp_label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.audience} · via {m.channel}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyMessage(key, m)}
                        className="gap-1.5"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subject / headline</Label>
                      <Input
                        value={m.subject}
                        onChange={(e) => updateMessage(key, "subject", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Body</Label>
                      <Textarea
                        rows={6}
                        value={m.body}
                        onChange={(e) => updateMessage(key, "body", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          {!pack ? (
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
                Generate Pack
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={reset}>
                Start over
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

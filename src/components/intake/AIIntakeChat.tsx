import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Markdown } from "@/components/ui/markdown";
import { Loader2, Send, Sparkles, CheckCircle2, RotateCcw, PencilLine, BookOpen, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

type KbArticle = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  similarity: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  articles?: KbArticle[];
};

interface Props {
  intent: "ticket" | "change_request";
  /** Greeting shown as the first AI message before the user types. */
  greeting?: string;
}

const DEFAULT_GREETINGS: Record<Props["intent"], string> = {
  ticket:
    "Hi! I'll help you raise a support ticket. In a sentence or two, what's going on?",
  change_request:
    "Hi! I'll help you draft a change request. What change are you proposing, and why?",
};

const TICKET_TYPES = ["support", "incident", "service_request", "question", "problem"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const CHANGE_TYPES = ["standard", "normal", "emergency", "operational"];
const IMPACT_LEVELS = ["low", "medium", "high", "critical"];

export function AIIntakeChat({ intent, greeting }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: greeting ?? DEFAULT_GREETINGS[intent] },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shownArticleIds, setShownArticleIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, draft, loading]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || !currentOrganization?.id) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    if (!overrideText) setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-ticket-intake", {
        body: {
          intent,
          organization_id: currentOrganization.id,
          messages: next.map(({ role, content }) => ({ role, content })),
          shown_article_ids: shownArticleIds,
        },
      });
      if (error) throw error;
      if (data?.status === "draft_ready" && data.draft) {
        setDraft(data.draft);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              data.draft.summary_for_user ??
              "I've drafted this for you — please review below and confirm.",
          },
        ]);
      } else if (data?.status === "kb_suggestions" && Array.isArray(data.articles)) {
        const articles = data.articles as KbArticle[];
        setShownArticleIds((ids) => [...ids, ...articles.map((a) => a.id)]);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.message ?? "Here are some articles that might help:",
            articles,
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data?.message ?? "Tell me a bit more, please." },
        ]);
      }
    } catch (e: any) {
      toast.error("AI assistant failed: " + (e?.message ?? "unknown"));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([{ role: "assistant", content: greeting ?? DEFAULT_GREETINGS[intent] }]);
    setDraft(null);
    setInput("");
    setShownArticleIds([]);
  };

  const updateDraft = (field: string, value: any) =>
    setDraft((d: any) => ({ ...d, [field]: value }));

  const submitDraft = async () => {
    if (!draft || !currentOrganization?.id) return;
    setSubmitting(true);
    try {
      if (intent === "ticket") {
        const { data, error } = await supabase
          .from("helpdesk_tickets")
          .insert({
            organization_id: currentOrganization.id,
            subject: draft.subject,
            description: draft.description,
            ticket_type: draft.ticket_type,
            priority: draft.priority,
            category: draft.category ?? null,
            reporter_user_id: user?.id ?? null,
            reporter_email: user?.email ?? null,
            created_by: user?.id ?? null,
            source: "internal" as any,
          })
          .select("id, reference_number")
          .single();
        if (error) throw error;
        toast.success(`Ticket ${data.reference_number ?? ""} created`);
        navigate(`/support/tickets/${data.id}`);
      } else {
        const { data, error } = await supabase
          .from("change_management_requests")
          .insert({
            organization_id: currentOrganization.id,
            title: draft.title,
            description: draft.description,
            change_type: draft.change_type,
            impact: draft.impact,
            urgency: draft.urgency,
            reason: draft.reason ?? null,
            business_justification: draft.business_justification ?? null,
            implementation_plan: draft.implementation_plan ?? null,
            rollback_plan: draft.rollback_plan ?? null,
            test_plan: draft.test_plan ?? null,
            downtime_required: !!draft.downtime_required,
            affected_services: draft.affected_services ?? null,
            requested_by: user?.id ?? null,
            created_by: user?.id ?? null,
            status: "submitted" as any,
          })
          .select("id, reference_number")
          .single();
        if (error) throw error;
        toast.success(`Change ${data.reference_number ?? ""} submitted`);
        navigate(`/change-management/${data.id}`);
      }
    } catch (e: any) {
      toast.error("Submit failed: " + (e?.message ?? "unknown"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-0 overflow-hidden border-primary/20">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">
              {intent === "ticket" ? "Support intake assistant" : "Change request assistant"}
            </p>
            <p className="text-xs text-muted-foreground">
              I'll ask a couple of quick questions, then draft this for you.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restart
        </Button>
      </div>

      <div ref={scrollRef} className="max-h-[420px] overflow-y-auto px-4 py-4 space-y-3 bg-background">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {m.role === "assistant" ? <Markdown content={m.content} /> : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      {!draft && (
        <div className="border-t p-3 flex items-end gap-2 bg-card">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your reply…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} disabled={!input.trim() || loading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      {draft && (
        <div className="border-t bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PencilLine className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Review & confirm draft</h3>
            <Badge variant="secondary" className="text-xs">AI-drafted</Badge>
          </div>

          {intent === "ticket" ? (
            <>
              <Field label="Subject">
                <Input value={draft.subject ?? ""} onChange={(e) => updateDraft("subject", e.target.value)} />
              </Field>
              <Field label="Description">
                <Textarea rows={5} value={draft.description ?? ""} onChange={(e) => updateDraft("description", e.target.value)} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Type">
                  <Select value={draft.ticket_type} onValueChange={(v) => updateDraft("ticket_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TICKET_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Priority">
                  <Select value={draft.priority} onValueChange={(v) => updateDraft("priority", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Category">
                  <Input value={draft.category ?? ""} onChange={(e) => updateDraft("category", e.target.value)} />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Title">
                <Input value={draft.title ?? ""} onChange={(e) => updateDraft("title", e.target.value)} />
              </Field>
              <Field label="Description">
                <Textarea rows={4} value={draft.description ?? ""} onChange={(e) => updateDraft("description", e.target.value)} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Type">
                  <Select value={draft.change_type} onValueChange={(v) => updateDraft("change_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Impact">
                  <Select value={draft.impact} onValueChange={(v) => updateDraft("impact", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IMPACT_LEVELS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Urgency">
                  <Select value={draft.urgency} onValueChange={(v) => updateDraft("urgency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IMPACT_LEVELS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Reason">
                <Textarea rows={2} value={draft.reason ?? ""} onChange={(e) => updateDraft("reason", e.target.value)} />
              </Field>
              <Field label="Implementation plan">
                <Textarea rows={3} value={draft.implementation_plan ?? ""} onChange={(e) => updateDraft("implementation_plan", e.target.value)} />
              </Field>
              <Field label="Rollback plan">
                <Textarea rows={2} value={draft.rollback_plan ?? ""} onChange={(e) => updateDraft("rollback_plan", e.target.value)} />
              </Field>
              <Field label="Test plan">
                <Textarea rows={2} value={draft.test_plan ?? ""} onChange={(e) => updateDraft("test_plan", e.target.value)} />
              </Field>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!draft.downtime_required}
                  onCheckedChange={(v) => updateDraft("downtime_required", v)}
                  id="downtime"
                />
                <Label htmlFor="downtime" className="text-sm">Downtime required</Label>
              </div>
              {Array.isArray(draft.affected_services) && draft.affected_services.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Affected services: {draft.affected_services.join(", ")}
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={reset} disabled={submitting}>
              Discard
            </Button>
            <Button onClick={submitDraft} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              {intent === "ticket" ? "Submit ticket" : "Submit change request"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

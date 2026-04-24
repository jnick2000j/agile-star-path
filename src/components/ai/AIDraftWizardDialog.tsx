import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Send, RotateCw, CheckCircle2, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { notifyAiCreditsChanged } from "@/components/billing/AICreditsMeter";
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
  | "issue_suggestions"
  | "vision_statement"
  | "comms_pack_draft"
  | "governance_narrative"
  | "risk_heatmap_narrative"
  | "stakeholder_map"
  | "lessons_digest"
  | "sprint_retro_summary"
  | "definition_of_ready"
  | "cm_normal_change"
  | "cm_standard_change"
  | "cm_emergency_change"
  | "cm_rollback_plan"
  | "cm_cab_pack"
  | "cm_post_implementation_review"
  | "cm_impact_assessment"
  | "hd_incident_writeup"
  | "hd_problem_record"
  | "hd_service_request"
  | "hd_kb_article"
  | "hd_major_incident_comms"
  | "hd_csat_followup"
  | "hd_sla_policy_draft"
  | "con_rfi"
  | "con_submittal_log"
  | "con_method_statement"
  | "con_ncr"
  | "con_toolbox_talk"
  | "con_daily_log"
  | "con_change_order"
  | "con_commissioning_pack"
  | "con_handover_register"
  | "con_subcontractor_scope"
  | "con_lookahead_plan"
  | "con_permit_to_work"
  | "ps_sow_draft"
  | "ps_msa_summary_draft"
  | "ps_change_order_draft"
  | "ps_proposal_exec_summary"
  | "ps_engagement_kickoff"
  | "ps_status_report"
  | "ps_qbr_pack"
  | "ps_wip_writeoff"
  | "ps_case_study_draft"
  | "ps_csat_followup";

export interface WizardField {
  key: string;
  label: string;
  type?: "text" | "textarea";
  placeholder?: string;
  required?: boolean;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wizard: WizardKind;
  title: string;
  description: string;
  /** Used to hint the AI about minimum coverage; no longer rendered as a form. */
  fields: WizardField[];
  entityType?: string;
  entityId?: string;
  /** Optional: called when the user accepts the draft locally (skips approval gate). */
  onAccept?: (content: string) => void;
}

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-draft-chat`;

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
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  // Greet the user on first open.
  useEffect(() => {
    if (open && messages.length === 0 && !draft) {
      void send("", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setMessages([]);
      setInput("");
      setDraft("");
      setAuditId(null);
      setStreaming(false);
    }
  }, [open]);

  useEffect(() => scrollToBottom(), [messages, streaming]);

  const send = async (text: string, isInitialGreeting = false) => {
    if (streaming) return;
    const trimmed = text.trim();
    if (!isInitialGreeting && !trimmed) return;

    const nextMessages: ChatMsg[] = isInitialGreeting
      ? []
      : [...messages, { role: "user", content: trimmed }];
    if (!isInitialGreeting) setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    // Insert an empty assistant placeholder we'll fill as tokens arrive.
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");

      const resp = await fetch(STREAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          wizard,
          title,
          required_fields: fields,
          messages: nextMessages,
          organization_id: currentOrganization?.id ?? null,
          entity_type: entityType ?? null,
          entity_id: entityId ?? null,
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        let errMsg = "Couldn't reach the AI service.";
        try {
          const ej = await resp.json();
          if (ej?.code === "credits_exhausted") errMsg = ej.error ?? "AI credit allowance reached.";
          else if (ej?.code === "rate_limited") errMsg = "AI is busy — try again shortly.";
          else if (ej?.code === "residency_blocked") errMsg = ej.error ?? "Blocked by data-residency policy.";
          else if (ej?.error) errMsg = ej.error;
        } catch { /* ignore */ }
        toast.error(errMsg);
        // remove the empty assistant placeholder
        setMessages((prev) => prev.slice(0, -1));
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let toolName = "";
      let toolArgs = "";
      let assistantText = "";
      let done = false;

      const processLine = (line: string) => {
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) return;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") { done = true; return; }
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            assistantText += delta.content;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: assistantText };
              }
              return copy;
            });
          }
          const tcs = delta?.tool_calls;
          if (Array.isArray(tcs)) {
            for (const tc of tcs) {
              if (tc?.function?.name) toolName = tc.function.name;
              if (tc?.function?.arguments) toolArgs += tc.function.arguments;
            }
          }
        } catch {
          // partial JSON — buffer was sliced wrong
        }
      };

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        textBuffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          const line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (!line.trim() || line.startsWith(":")) continue;
          processLine(line);
        }
      }
      if (textBuffer.trim()) processLine(textBuffer);

      notifyAiCreditsChanged();

      // If the model produced a final draft, swap into "review & approve" mode.
      if (toolName === "produce_draft" && toolArgs) {
        try {
          const args = JSON.parse(toolArgs);
          const finalContent: string = args.content ?? "";
          setDraft(finalContent);
          // Replace the empty/placeholder assistant turn with a friendly handoff.
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            const handoff = "I've prepared the draft. You can review it on the right and approve it when you're happy.";
            if (last?.role === "assistant" && (!last.content || last.content.trim().length < 20)) {
              copy[copy.length - 1] = { ...last, content: handoff };
            } else {
              copy.push({ role: "assistant", content: handoff });
            }
            return copy;
          });
          // Try to locate the audit log entry the edge function just wrote.
          await locateAuditEntry();
        } catch (e) {
          console.error("Couldn't parse produce_draft tool args", e);
        }
      } else if (!assistantText.trim()) {
        // No content and no tool — drop the empty bubble.
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast.error("Connection lost while talking to the AI.");
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  /** Find the audit row that the edge function wrote moments ago. */
  const locateAuditEntry = async () => {
    setResolving(true);
    try {
      // Poll briefly — the background tee may write a beat after the stream closes.
      for (let i = 0; i < 6; i++) {
        const { data } = await supabase
          .from("ai_audit_log")
          .select("id, status")
          .eq("action_type", `wizard_chat:${wizard}`)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && data.length) {
          setAuditId(data[0].id);
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    } finally {
      setResolving(false);
    }
    toast.success("Draft ready — review and approve below.");
  };

  const approve = async () => {
    if (!auditId) {
      toast.error("Couldn't find the draft to approve.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("ai_audit_log")
      .update({
        status: "approved",
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        // Persist any user edits from the textarea.
        draft_payload: { content: draft, conversation: messages },
      })
      .eq("id", auditId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Draft approved.");
    onAccept?.(draft);
    onOpenChange(false);
  };

  const reject = async () => {
    if (!auditId) {
      onOpenChange(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("ai_audit_log")
      .update({
        status: "rejected",
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", auditId);
    toast.message("Draft rejected.");
    onOpenChange(false);
  };

  const restart = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setDraft("");
    setAuditId(null);
    setStreaming(false);
    // Re-greet
    setTimeout(() => void send("", true), 50);
  };

  const inDraftMode = !!draft;

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className={`${inDraftMode ? "max-w-5xl" : "max-w-2xl"} max-h-[90vh] flex flex-col p-0`}>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {title}
            {inDraftMode ? (
              <Badge variant="outline" className="text-xs gap-1">
                <FileText className="h-3 w-3" /> Draft ready
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Conversational intake</Badge>
            )}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className={`flex-1 grid ${inDraftMode ? "md:grid-cols-2" : "grid-cols-1"} gap-0 min-h-0 overflow-hidden border-t`}>
          {/* CHAT PANE */}
          <div className="flex flex-col min-h-0 border-r">
            <ScrollArea className="flex-1 px-4 py-3" viewportRef={scrollRef as any}>
              <div className="space-y-3">
                {messages.length === 0 && !streaming && (
                  <div className="text-sm text-muted-foreground italic py-8 text-center">
                    Connecting to the assistant…
                  </div>
                )}
                {messages.map((m, i) => (
                  <ChatBubble key={i} role={m.role} content={m.content} />
                ))}
                {streaming && messages[messages.length - 1]?.role !== "assistant" && (
                  <ChatBubble role="assistant" content="" typing />
                )}
              </div>
            </ScrollArea>

            {!inDraftMode && (
              <form
                className="border-t p-3 flex items-end gap-2 bg-background"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={streaming ? "Assistant is typing…" : "Type your reply…"}
                  disabled={streaming}
                  autoFocus
                />
                <Button type="submit" size="icon" disabled={streaming || !input.trim()}>
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={streaming || messages.length < 2}
                  onClick={() => void send("Please draft now with what you have. Mark assumptions as [ASSUMPTION].")}
                  title="Draft now"
                >
                  Draft now
                </Button>
              </form>
            )}
          </div>

          {/* DRAFT PANE */}
          {inDraftMode && (
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {resolving ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Logging draft for approval…</>
                  ) : auditId ? (
                    <><CheckCircle2 className="h-3 w-3 text-success" /> Pending approval entry created</>
                  ) : (
                    "Draft ready"
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={restart} className="h-7">
                  <RotateCw className="h-3 w-3 mr-1" /> Start over
                </Button>
              </div>
              <ScrollArea className="flex-1 px-4 py-3">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{draft}</ReactMarkdown>
                </div>
                <details className="mt-4 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Edit raw markdown</summary>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full mt-2 min-h-[200px] font-mono text-xs p-2 rounded border bg-background"
                  />
                </details>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t gap-2">
          {inDraftMode ? (
            <>
              <Button variant="ghost" onClick={reject}>Reject</Button>
              {onAccept && (
                <Button variant="outline" onClick={() => { onAccept(draft); onOpenChange(false); }}>
                  Use locally (skip approval)
                </Button>
              )}
              <Button onClick={approve} disabled={resolving || !auditId}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve & save
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChatBubble({ role, content, typing }: { role: "user" | "assistant"; content: string; typing?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {typing || (!content && !isUser) ? (
          <span className="inline-flex gap-1 items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce" />
          </span>
        ) : isUser ? (
          content
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

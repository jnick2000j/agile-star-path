import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type TaskPriority = (typeof TASK_PRIORITIES)[number];

// Map ticket priorities to task priorities (1:1 today, but explicit so future
// changes to either enum don't silently drift).
const TICKET_TO_TASK_PRIORITY: Record<string, TaskPriority> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
};

type EntityKind = "programme" | "project" | "product";

interface Ticket {
  id: string;
  organization_id: string;
  reference_number: string | null;
  subject: string;
  description: string | null;
  priority: string;
  programme_id: string | null;
  project_id: string | null;
  product_id: string | null;
  converted_to_task_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
  onConverted?: (taskId: string) => void;
}

interface EntityOption {
  id: string;
  name: string;
}

const HD_BUCKET = "helpdesk-attachments";
const DOC_BUCKET = "documents";

export function ConvertTicketToTaskDialog({ open, onOpenChange, ticket, onConverted }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Pre-seed entity from the ticket if it's already linked to one.
  const seededEntityKind: EntityKind = ticket.product_id
    ? "product"
    : ticket.project_id
      ? "project"
      : "programme";
  const seededEntityId =
    ticket.product_id ?? ticket.project_id ?? ticket.programme_id ?? "";

  const [entityKind, setEntityKind] = useState<EntityKind>(seededEntityKind);
  const [entityId, setEntityId] = useState<string>(seededEntityId);
  const [taskName, setTaskName] = useState(
    ticket.reference_number ? `[${ticket.reference_number}] ${ticket.subject}` : ticket.subject,
  );
  const [priority, setPriority] = useState<TaskPriority>(
    TICKET_TO_TASK_PRIORITY[ticket.priority] ?? "medium",
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset seed values when dialog re-opens against a different ticket.
  useEffect(() => {
    if (!open) return;
    setEntityKind(seededEntityKind);
    setEntityId(seededEntityId);
    setTaskName(
      ticket.reference_number ? `[${ticket.reference_number}] ${ticket.subject}` : ticket.subject,
    );
    setPriority(TICKET_TO_TASK_PRIORITY[ticket.priority] ?? "medium");
    setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket.id]);

  // Load entity options for the selected kind, scoped to this org.
  const { data: entities = [], isLoading: entitiesLoading } = useQuery({
    queryKey: ["convert-ticket-entities", entityKind, ticket.organization_id],
    enabled: open,
    queryFn: async (): Promise<EntityOption[]> => {
      const table = entityKind === "programme" ? "programmes" : entityKind === "project" ? "projects" : "products";
      const { data, error } = await (supabase as any)
        .from(table)
        .select("id, name")
        .eq("organization_id", ticket.organization_id)
        .order("name");
      if (error) {
        console.error("entity load failed", error);
        return [];
      }
      return (data ?? []) as EntityOption[];
    },
  });

  // Load attachments to show how many will be copied.
  const { data: attachments = [] } = useQuery({
    queryKey: ["ticket-attachments-for-convert", ticket.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_ticket_attachments")
        .select("id, file_name, storage_path, file_size, mime_type, is_internal")
        .eq("ticket_id", ticket.id);
      if (error) return [];
      return data ?? [];
    },
  });

  const alreadyConverted = !!ticket.converted_to_task_id;

  const entityFieldName = useMemo(
    () => (entityKind === "programme" ? "programme_id" : entityKind === "project" ? "project_id" : "product_id"),
    [entityKind],
  );

  const canSubmit =
    !submitting &&
    !alreadyConverted &&
    !!user &&
    !!entityId &&
    taskName.trim().length > 0 &&
    reason.trim().length >= 5;

  const handleConvert = async () => {
    if (!canSubmit || !user) return;
    setSubmitting(true);

    try {
      // 1. Build full task description from ticket + reason
      const linkRef = ticket.reference_number ? `Ticket ${ticket.reference_number}` : "Helpdesk ticket";
      const description = [
        `**Converted from ${linkRef}**`,
        "",
        `**Reason for conversion:** ${reason.trim()}`,
        "",
        "---",
        "",
        ticket.description || "_No description on the original ticket._",
      ].join("\n");

      // 2. Create the task
      const taskInsert: Record<string, any> = {
        organization_id: ticket.organization_id,
        name: taskName.trim(),
        description,
        priority,
        status: "not_started",
        created_by: user.id,
        source_ticket_id: ticket.id,
        [entityFieldName]: entityId,
      };
      const { data: createdTask, error: taskErr } = await (supabase as any)
        .from("tasks")
        .insert(taskInsert)
        .select("id")
        .single();
      if (taskErr || !createdTask) {
        throw new Error(taskErr?.message || "Could not create task");
      }
      const taskId = createdTask.id as string;

      // 3. Copy attachments (storage object + register as a task document)
      let copiedCount = 0;
      for (const att of attachments) {
        try {
          // Download from helpdesk bucket (private — use auth'd download).
          const { data: blob, error: dlErr } = await supabase.storage
            .from(HD_BUCKET)
            .download(att.storage_path);
          if (dlErr || !blob) {
            console.warn("attachment download failed", att.file_name, dlErr);
            continue;
          }
          const newPath = `task-${taskId}/${att.id}-${att.file_name}`;
          const { error: upErr } = await supabase.storage
            .from(DOC_BUCKET)
            .upload(newPath, blob, {
              contentType: att.mime_type ?? blob.type ?? undefined,
              upsert: false,
            });
          if (upErr) {
            console.warn("attachment upload failed", att.file_name, upErr);
            continue;
          }
          const { error: docErr } = await supabase.from("documents").insert({
            name: att.file_name,
            file_path: newPath,
            file_size: att.file_size,
            mime_type: att.mime_type,
            entity_type: "task",
            entity_id: taskId,
            uploaded_by: user.id,
          });
          if (docErr) {
            // Roll back the orphan storage object on failure.
            await supabase.storage.from(DOC_BUCKET).remove([newPath]);
            console.warn("document row failed", att.file_name, docErr);
            continue;
          }
          copiedCount++;
        } catch (e) {
          console.warn("copy attachment exception", att.file_name, e);
        }
      }

      // 4. Persist conversion audit + back-link on the ticket
      const conversionRow: Record<string, any> = {
        organization_id: ticket.organization_id,
        ticket_id: ticket.id,
        task_id: taskId,
        converted_by: user.id,
        reason: reason.trim(),
        task_priority: priority,
        attachments_copied: copiedCount,
        [entityFieldName]: entityId,
      };
      const { error: convErr } = await (supabase as any)
        .from("helpdesk_ticket_task_conversions")
        .insert(conversionRow);
      if (convErr) console.warn("conversion log insert failed", convErr);

      const { error: linkErr } = await supabase
        .from("helpdesk_tickets")
        .update({ converted_to_task_id: taskId })
        .eq("id", ticket.id);
      if (linkErr) console.warn("ticket back-link failed", linkErr);

      // 5. Internal comment trail (best effort)
      try {
        await supabase.from("helpdesk_ticket_comments").insert({
          ticket_id: ticket.id,
          organization_id: ticket.organization_id,
          author_user_id: user.id,
          body: `🔁 Converted to task — ${entityKind}: \`${taskName.trim()}\` (priority: ${priority})\n\n**Reason:** ${reason.trim()}\n${copiedCount} attachment(s) copied.`,
          is_internal: true,
        });
      } catch { /* best-effort */ }

      toast.success(`Task created${copiedCount ? ` with ${copiedCount} attachment(s)` : ""}`);
      onOpenChange(false);
      onConverted?.(taskId);
      navigate(`/tasks?focus=${taskId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Conversion failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Convert ticket to task
          </DialogTitle>
          <DialogDescription>
            Create a delivery task tied to a programme, project or product. The ticket's description and
            attachments are imported.
          </DialogDescription>
        </DialogHeader>

        {alreadyConverted && (
          <Alert variant="destructive">
            <AlertDescription>This ticket has already been converted to a task.</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Linked entity</Label>
              <Select value={entityKind} onValueChange={(v) => { setEntityKind(v as EntityKind); setEntityId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="programme">Programme</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Task priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>{entityKind.charAt(0).toUpperCase() + entityKind.slice(1)}</Label>
            <Select value={entityId} onValueChange={setEntityId} disabled={entitiesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={entitiesLoading ? "Loading…" : `Select a ${entityKind}`} />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Task name</Label>
            <Input value={taskName} onChange={(e) => setTaskName(e.target.value)} maxLength={200} />
          </div>

          <div>
            <Label>Reason for converting <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Ticket reveals underlying delivery work — needs sprint planning rather than a one-off support fix."
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recorded in the audit trail and surfaced on both the ticket and the new task.
            </p>
          </div>

          {attachments.length > 0 && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Badge variant="secondary">{attachments.length}</Badge>
              attachment{attachments.length === 1 ? "" : "s"} will be copied to the new task.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Convert to task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

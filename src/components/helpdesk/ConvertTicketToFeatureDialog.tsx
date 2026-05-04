import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lightbulb } from "lucide-react";
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

const FEATURE_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type FeaturePriority = (typeof FEATURE_PRIORITIES)[number];

const TICKET_TO_FEATURE_PRIORITY: Record<string, FeaturePriority> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
};

const MOSCOW_OPTIONS = [
  { value: "must", label: "Must have" },
  { value: "should", label: "Should have" },
  { value: "could", label: "Could have" },
  { value: "wont", label: "Won't have (this time)" },
] as const;

interface Ticket {
  id: string;
  organization_id: string;
  reference_number: string | null;
  subject: string;
  description: string | null;
  priority: string;
  product_id: string | null;
  converted_to_feature_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
  onConverted?: (featureId: string) => void;
}

interface ProductOption {
  id: string;
  name: string;
}

const HD_BUCKET = "helpdesk-attachments";
const DOC_BUCKET = "documents";

export function ConvertTicketToFeatureDialog({ open, onOpenChange, ticket, onConverted }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [productId, setProductId] = useState<string>(ticket.product_id ?? "");
  const [featureName, setFeatureName] = useState(
    ticket.reference_number ? `[${ticket.reference_number}] ${ticket.subject}` : ticket.subject,
  );
  const [priority, setPriority] = useState<FeaturePriority>(
    TICKET_TO_FEATURE_PRIORITY[ticket.priority] ?? "medium",
  );
  const [moscow, setMoscow] = useState<string>("should");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductId(ticket.product_id ?? "");
    setFeatureName(
      ticket.reference_number ? `[${ticket.reference_number}] ${ticket.subject}` : ticket.subject,
    );
    setPriority(TICKET_TO_FEATURE_PRIORITY[ticket.priority] ?? "medium");
    setMoscow("should");
    setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket.id]);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["convert-ticket-products", ticket.organization_id],
    enabled: open,
    queryFn: async (): Promise<ProductOption[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("organization_id", ticket.organization_id)
        .order("name");
      if (error) {
        console.error("product load failed", error);
        return [];
      }
      return (data ?? []) as ProductOption[];
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["ticket-attachments-for-feature-convert", ticket.id],
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

  const alreadyConverted = !!ticket.converted_to_feature_id;

  const canSubmit =
    !submitting &&
    !alreadyConverted &&
    !!user &&
    !!productId &&
    featureName.trim().length > 0 &&
    reason.trim().length >= 5;

  const handleConvert = async () => {
    if (!canSubmit || !user) return;
    setSubmitting(true);

    try {
      const linkRef = ticket.reference_number ? `Ticket ${ticket.reference_number}` : "Helpdesk ticket";
      const description = [
        `**Converted from ${linkRef}**`,
        "",
        `**Reason for feature request:** ${reason.trim()}`,
        "",
        "---",
        "",
        ticket.description || "_No description on the original ticket._",
      ].join("\n");

      const featureInsert: Record<string, any> = {
        organization_id: ticket.organization_id,
        product_id: productId,
        name: featureName.trim(),
        description,
        priority,
        moscow,
        status: "backlog",
        created_by: user.id,
        source_ticket_id: ticket.id,
      };
      const { data: createdFeature, error: featErr } = await (supabase as any)
        .from("product_features")
        .insert(featureInsert)
        .select("id")
        .single();
      if (featErr || !createdFeature) {
        throw new Error(featErr?.message || "Could not create feature");
      }
      const featureId = createdFeature.id as string;

      // Copy attachments into documents bucket and register them against the feature.
      let copiedCount = 0;
      for (const att of attachments) {
        try {
          const { data: blob, error: dlErr } = await supabase.storage
            .from(HD_BUCKET)
            .download(att.storage_path);
          if (dlErr || !blob) {
            console.warn("attachment download failed", att.file_name, dlErr);
            continue;
          }
          const newPath = `feature-${featureId}/${att.id}-${att.file_name}`;
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
            entity_type: "product_feature",
            entity_id: featureId,
            uploaded_by: user.id,
          });
          if (docErr) {
            await supabase.storage.from(DOC_BUCKET).remove([newPath]);
            console.warn("document row failed", att.file_name, docErr);
            continue;
          }
          copiedCount++;
        } catch (e) {
          console.warn("copy attachment exception", att.file_name, e);
        }
      }

      const conversionRow: Record<string, any> = {
        organization_id: ticket.organization_id,
        ticket_id: ticket.id,
        feature_id: featureId,
        product_id: productId,
        converted_by: user.id,
        reason: reason.trim(),
        feature_priority: priority,
        attachments_copied: copiedCount,
      };
      const { error: convErr } = await (supabase as any)
        .from("helpdesk_ticket_feature_conversions")
        .insert(conversionRow);
      if (convErr) console.warn("conversion log insert failed", convErr);

      const { error: linkErr } = await (supabase as any)
        .from("helpdesk_tickets")
        .update({ converted_to_feature_id: featureId })
        .eq("id", ticket.id);
      if (linkErr) console.warn("ticket back-link failed", linkErr);

      try {
        await supabase.from("helpdesk_ticket_comments").insert({
          ticket_id: ticket.id,
          organization_id: ticket.organization_id,
          author_user_id: user.id,
          body: `💡 Converted to feature request — \`${featureName.trim()}\` (priority: ${priority}, MoSCoW: ${moscow})\n\n**Reason:** ${reason.trim()}\n${copiedCount} attachment(s) copied.`,
          is_internal: true,
        });
      } catch { /* best-effort */ }

      toast.success(`Feature request created${copiedCount ? ` with ${copiedCount} attachment(s)` : ""}`);
      onOpenChange(false);
      onConverted?.(featureId);
      navigate(`/feature-backlog?focus=${featureId}`);
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
            <Lightbulb className="h-4 w-4 text-primary" />
            Convert ticket to feature request
          </DialogTitle>
          <DialogDescription>
            Add this ticket to a product backlog as a feature request. The ticket's description and
            attachments are imported.
          </DialogDescription>
        </DialogHeader>

        {alreadyConverted && (
          <Alert variant="destructive">
            <AlertDescription>This ticket has already been converted to a feature request.</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId} disabled={productsLoading}>
              <SelectTrigger>
                <SelectValue placeholder={productsLoading ? "Loading…" : "Select a product"} />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as FeaturePriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEATURE_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>MoSCoW</Label>
              <Select value={moscow} onValueChange={setMoscow}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOSCOW_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Feature name</Label>
            <Input value={featureName} onChange={(e) => setFeatureName(e.target.value)} maxLength={200} />
          </div>

          <div>
            <Label>Reason for converting <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Multiple customers request this — should be planned as a roadmap feature rather than handled per-ticket."
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recorded in the audit trail and surfaced on both the ticket and the new feature.
            </p>
          </div>

          {attachments.length > 0 && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Badge variant="secondary">{attachments.length}</Badge>
              attachment{attachments.length === 1 ? "" : "s"} will be copied to the new feature.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Convert to feature request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  itemId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (ticketId: string) => void;
}

export function RequestCatalogItemDialog({ itemId, open, onOpenChange, onCreated }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: item } = useQuery({
    queryKey: ["svc-item", itemId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_catalog_items")
        .select("*, service_catalog_item_fields(*), service_catalog_categories(name)")
        .eq("id", itemId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!itemId,
  });

  const fields = (item?.service_catalog_item_fields ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);

  const setAnswer = (key: string, value: any) => setAnswers((a) => ({ ...a, [key]: value }));

  const submit = async () => {
    if (!currentOrganization?.id || !user?.id || !item) return;
    // validate required
    for (const f of fields) {
      if (f.is_required) {
        const v = answers[f.field_key];
        const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty) { toast.error(`"${f.label}" is required`); return; }
      }
    }
    setSubmitting(true);
    try {
      // 1. Get reporter profile for name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      const reporterName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || null;

      // 2. Create the ticket
      const subject = `[Service Request] ${item.name}`;
      const description = notes || `Service catalog request: ${item.name}`;
      const { data: ticket, error: tErr } = await supabase
        .from("helpdesk_tickets")
        .insert({
          organization_id: currentOrganization.id,
          subject,
          description,
          ticket_type: "service_request",
          priority: item.default_priority,
          source: "portal",
          reporter_user_id: user.id,
          reporter_name: reporterName,
          reporter_email: profile?.email ?? null,
          assignee_id: item.default_assignee_id ?? null,
          created_by: user.id,
          metadata: { catalog_item_id: item.id, catalog_item_name: item.name },
        })
        .select("id")
        .single();
      if (tErr) throw tErr;

      // 3. Save request data
      await supabase.from("service_catalog_request_data").insert({
        organization_id: currentOrganization.id,
        ticket_id: ticket.id,
        item_id: item.id,
        answers,
        cost_estimate: item.cost_estimate,
      });

      // 4. Create approval steps
      if (item.approval_policy === "specific_users" && (item.approver_user_ids ?? []).length > 0) {
        const rows = item.approver_user_ids.map((uid: string, idx: number) => ({
          organization_id: currentOrganization.id,
          ticket_id: ticket.id,
          step_order: idx + 1,
          approver_user_id: uid,
          status: "pending" as const,
        }));
        await supabase.from("service_catalog_request_approvals").insert(rows);
        // Hold ticket until approvals complete
        await supabase.from("helpdesk_tickets").update({ status: "pending" }).eq("id", ticket.id);
      } else if (item.approval_policy === "manager") {
        // No org-manager-of-user mapping yet; mark ticket pending for now
        await supabase.from("helpdesk_tickets").update({ status: "pending" }).eq("id", ticket.id);
      }

      toast.success("Request submitted");
      onOpenChange(false);
      setAnswers({}); setNotes("");
      onCreated?.(ticket.id);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Request: {item.name}</DialogTitle>
          {item.short_description && <DialogDescription>{item.short_description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          {item.cost_estimate != null && (
            <Badge variant="outline">Est. cost ${Number(item.cost_estimate).toLocaleString()}</Badge>
          )}
          {fields.map((f: any) => (
            <FieldInput key={f.id} field={f} value={answers[f.field_key]} onChange={(v) => setAnswer(f.field_key, v)} />
          ))}
          <div>
            <Label>Additional notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context for fulfillment team" />
          </div>
          {item.approval_policy !== "none" && (
            <p className="text-xs text-muted-foreground">
              This request requires approval before fulfillment begins.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({ field, value, onChange }: { field: any; value: any; onChange: (v: any) => void }) {
  const label = (
    <Label className="flex items-center gap-1">
      {field.label}{field.is_required && <span className="text-destructive">*</span>}
    </Label>
  );
  switch (field.field_type) {
    case "text":
      return <div>{label}<Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} /></div>;
    case "textarea":
      return <div>{label}<Textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></div>;
    case "number":
      return <div>{label}<Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></div>;
    case "date":
      return <div>{label}<Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></div>;
    case "checkbox":
      return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />{field.label}</label>;
    case "select":
      return (
        <div>{label}
          <Select value={value ?? ""} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>{(field.options ?? []).map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      );
    case "multiselect": {
      const arr: string[] = Array.isArray(value) ? value : [];
      const toggle = (v: string) => onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
      return (
        <div>{label}
          <div className="mt-1 flex flex-wrap gap-1">
            {(field.options ?? []).map((o: any) => (
              <Badge key={o.value} variant={arr.includes(o.value) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggle(o.value)}>
                {o.label}
              </Badge>
            ))}
          </div>
        </div>
      );
    }
    case "user":
      return <div>{label}<Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="User name or email" /></div>;
    default:
      return null;
  }
}

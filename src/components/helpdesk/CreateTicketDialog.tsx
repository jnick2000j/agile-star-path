import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { KBInlineSuggestions } from "@/components/kb/KBInlineSuggestions";
import { CatalogPicker, saveTicketCatalogSelection, type CatalogSelection, type CatalogItemDefaults } from "@/components/helpdesk/CatalogPicker";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  defaultProgrammeId?: string;
  defaultProjectId?: string;
  defaultProductId?: string;
}

export function CreateTicketDialog({
  open,
  onOpenChange,
  onCreated,
  defaultProgrammeId,
  defaultProjectId,
  defaultProductId,
}: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [catalogSelection, setCatalogSelection] = useState<CatalogSelection>({});
  // Track which fields the user has manually edited so we don't overwrite their input
  const [touched, setTouched] = useState<Record<"category" | "priority" | "ticket_type", boolean>>({
    category: false,
    priority: false,
    ticket_type: false,
  });
  const [form, setForm] = useState({
    subject: "",
    description: "",
    ticket_type: "support",
    priority: "medium",
    category: "",
    programme_id: defaultProgrammeId || "",
    project_id: defaultProjectId || "",
    product_id: defaultProductId || "",
  });

  const handleCatalogItemAdded = (defaults: CatalogItemDefaults, itemName: string) => {
    setForm((prev) => {
      const next = { ...prev };
      const applied: string[] = [];
      if (defaults.default_category && !touched.category && !prev.category.trim()) {
        next.category = defaults.default_category;
        applied.push(`category "${defaults.default_category}"`);
      }
      if (defaults.default_priority && !touched.priority) {
        next.priority = defaults.default_priority;
        applied.push(`priority ${defaults.default_priority}`);
      }
      if (defaults.default_ticket_type && !touched.ticket_type) {
        next.ticket_type = defaults.default_ticket_type;
        applied.push(`type ${defaults.default_ticket_type.replace("_", " ")}`);
      }
      if (applied.length > 0) {
        toast.info(`Auto-filled from "${itemName}": ${applied.join(", ")}`);
      }
      return next;
    });
  };

  const { data: programmes = [] } = useQuery({
    queryKey: ["programmes-min", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("programmes")
        .select("id, name")
        .eq("organization_id", currentOrganization.id)
        .order("name");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && open,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-min", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", currentOrganization.id)
        .order("name");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && open,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-min", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("products")
        .select("id, name")
        .eq("organization_id", currentOrganization.id)
        .order("name");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && open,
  });

  const handleSubmit = async () => {
    if (!currentOrganization?.id || !form.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setSubmitting(true);
    const { data: created, error } = await supabase.from("helpdesk_tickets").insert({
      organization_id: currentOrganization.id,
      subject: form.subject.trim(),
      description: form.description.trim() || null,
      ticket_type: form.ticket_type as any,
      priority: form.priority as any,
      category: form.category.trim() || null,
      reporter_user_id: user?.id ?? null,
      reporter_email: user?.email ?? null,
      created_by: user?.id ?? null,
      source: "internal" as any,
      programme_id: form.programme_id || null,
      project_id: form.project_id || null,
      product_id: form.product_id || null,
    }).select("id").single();
    setSubmitting(false);
    if (error) {
      toast.error("Failed to create ticket: " + error.message);
      return;
    }
    // Save catalog selections
    if (created?.id) {
      try {
        await saveTicketCatalogSelection(created.id, currentOrganization.id, catalogSelection, user?.id);
      } catch (e: any) {
        toast.error("Ticket created, but failed to save catalog selections: " + e.message);
      }
    }
    // Send confirmation email to the reporter and dispatch workflows
    if (created?.id) {
      supabase.functions.invoke("helpdesk-notify", {
        body: { ticket_id: created.id, notification_type: "created" },
      }).catch(() => {});
      const { dispatchHelpdeskWorkflow } = await import("@/lib/helpdeskWorkflows");
      dispatchHelpdeskWorkflow({
        organization_id: currentOrganization.id,
        trigger_event: "ticket_created",
        ticket_id: created.id,
        triggered_by: user?.id,
      });
    }
    toast.success("Ticket created");
    onOpenChange(false);
    setForm({
      subject: "", description: "", ticket_type: "support", priority: "medium",
      category: "", programme_id: "", project_id: "", product_id: "",
    });
    setCatalogSelection({});
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Helpdesk Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Brief summary of the issue"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.ticket_type} onValueChange={(v) => setForm({ ...form, ticket_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="service_request">Service Request</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="problem">Problem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Access, Performance, Bug, Question"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide as much detail as possible..."
            />
          </div>
          <KBInlineSuggestions subject={form.subject} description={form.description} />
          <div className="border-t pt-4">
            <CatalogPicker
              value={catalogSelection}
              onChange={setCatalogSelection}
              ticketType={form.ticket_type}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Programme</Label>
              <Select value={form.programme_id || "none"} onValueChange={(v) => setForm({ ...form, programme_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {programmes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={form.project_id || "none"} onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={form.product_id || "none"} onValueChange={(v) => setForm({ ...form, product_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "Create Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

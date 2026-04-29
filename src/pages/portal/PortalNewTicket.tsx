import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export default function PortalNewTicket() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [type, setType] = useState<"support" | "incident" | "service_request" | "question">("support");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !description.trim() || !user || !currentOrganization) {
      toast.error("Subject and description are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .insert({
          organization_id: currentOrganization.id,
          subject: subject.trim(),
          description: description.trim(),
          priority,
          ticket_type: type,
          source: "portal",
          status: "new",
          reporter_user_id: user.id,
          reporter_email: user.email,
          created_by: user.id,
        })
        .select("id, reference_number")
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Ticket ${data.reference_number ?? "created"}`);
      navigate(`/portal/tickets/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Plus className="h-6 w-6" /> Submit a Request
        </h1>
        <p className="text-sm text-muted-foreground">
          Tell us what's going on — we'll route it to the right team.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <Label>Subject *</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of your issue"
            maxLength={200}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="support">Support question</SelectItem>
                <SelectItem value="incident">Something is broken</SelectItem>
                <SelectItem value="service_request">Service request</SelectItem>
                <SelectItem value="question">General question</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent — production down</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Description *</Label>
          <Textarea
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? Include steps to reproduce, expected vs actual behavior, screenshots if helpful…"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/portal/tickets")}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</>
            ) : (
              "Submit Request"
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

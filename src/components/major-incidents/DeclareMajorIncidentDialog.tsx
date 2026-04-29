import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seedTicketId?: string;
  seedTitle?: string;
  seedDescription?: string;
}

export function DeclareMajorIncidentDialog({ open, onOpenChange, seedTicketId, seedTitle, seedDescription }: Props) {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState(seedTitle ?? "");
  const [description, setDescription] = useState(seedDescription ?? "");
  const [severity, setSeverity] = useState<string>("sev2");
  const [impact, setImpact] = useState("");

  const declare = useMutation({
    mutationFn: async () => {
      if (!currentOrganization?.id) throw new Error("No organization");
      const { data: user } = await supabase.auth.getUser();
      const { data: mi, error } = await supabase
        .from("major_incidents")
        .insert({
          organization_id: currentOrganization.id,
          title,
          description: description || null,
          severity,
          impact: impact || null,
          created_by: user.user?.id,
          incident_commander_id: user.user?.id,
        } as any)
        .select("id, reference_number")
        .single();
      if (error) throw error;
      if (seedTicketId) {
        await supabase.from("major_incident_tickets").insert({
          major_incident_id: mi.id,
          ticket_id: seedTicketId,
          organization_id: currentOrganization.id,
          linked_by: user.user?.id,
        } as any);
      }
      return mi;
    },
    onSuccess: (mi: any) => {
      toast.success(`Major incident ${mi.reference_number} declared`);
      qc.invalidateQueries({ queryKey: ["major-incidents"] });
      qc.invalidateQueries({ queryKey: ["ticket-major-incidents"] });
      onOpenChange(false);
      navigate(`/major-incidents/${mi.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Declare Major Incident</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief incident summary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sev1">SEV1 — Critical</SelectItem>
                  <SelectItem value="sev2">SEV2 — High</SelectItem>
                  <SelectItem value="sev3">SEV3 — Medium</SelectItem>
                  <SelectItem value="sev4">SEV4 — Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Impact</Label>
              <Input value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="e.g. Login outage" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => declare.mutate()} disabled={!title || declare.isPending}>
            {declare.isPending ? "Declaring..." : "Declare Incident"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

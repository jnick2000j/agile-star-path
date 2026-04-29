import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Siren, Plus, Link2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { DeclareMajorIncidentDialog } from "./DeclareMajorIncidentDialog";
import { toast } from "sonner";

interface Props {
  ticketId: string;
  ticketSubject: string;
  ticketDescription?: string | null;
}

export function TicketMajorIncidentPanel({ ticketId, ticketSubject, ticketDescription }: Props) {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [declareOpen, setDeclareOpen] = useState(false);
  const [selectedMI, setSelectedMI] = useState("");

  const { data: links = [] } = useQuery({
    queryKey: ["ticket-major-incidents", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("major_incident_tickets")
        .select("id, major_incident_id, major_incidents(id, reference_number, title, severity, status)")
        .eq("ticket_id", ticketId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: openMIs = [] } = useQuery({
    queryKey: ["open-major-incidents", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("major_incidents")
        .select("id, reference_number, title, severity, status")
        .eq("organization_id", currentOrganization.id)
        .not("status", "in", "(closed,resolved)")
        .order("declared_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const linkExisting = useMutation({
    mutationFn: async (miId: string) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("major_incident_tickets").insert({
        major_incident_id: miId,
        ticket_id: ticketId,
        organization_id: currentOrganization!.id,
        linked_by: user.user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-major-incidents", ticketId] });
      setSelectedMI("");
      toast.success("Linked to major incident");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("major_incident_tickets").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-major-incidents", ticketId] }),
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Siren className="h-4 w-4 text-destructive" /> Major Incident</h3>
      </div>

      {links.length > 0 ? (
        <div className="space-y-2">
          {links.map((l: any) => l.major_incidents && (
            <div key={l.id} className="flex items-center justify-between p-2 border rounded bg-destructive/5">
              <Link to={`/major-incidents/${l.major_incident_id}`} className="flex-1">
                <div className="font-mono text-xs">{l.major_incidents.reference_number}</div>
                <div className="text-sm font-medium">{l.major_incidents.title}</div>
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">{l.major_incidents.severity.toUpperCase()}</Badge>
                  <Badge variant="outline" className="text-xs">{l.major_incidents.status}</Badge>
                </div>
              </Link>
              <Button size="icon" variant="ghost" onClick={() => unlink.mutate(l.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Not linked to any major incident</p>
      )}

      <div className="space-y-2">
        {openMIs.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedMI} onValueChange={setSelectedMI}>
              <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Link existing..." /></SelectTrigger>
              <SelectContent>
                {openMIs.filter((mi: any) => !links.some((l: any) => l.major_incident_id === mi.id)).map((mi: any) => (
                  <SelectItem key={mi.id} value={mi.id}>
                    {mi.reference_number} — {mi.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={!selectedMI} onClick={() => linkExisting.mutate(selectedMI)}>
              <Link2 className="h-3 w-3" />
            </Button>
          </div>
        )}
        <Button size="sm" variant="destructive" className="w-full" onClick={() => setDeclareOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Declare Major Incident
        </Button>
      </div>

      <DeclareMajorIncidentDialog
        open={declareOpen}
        onOpenChange={setDeclareOpen}
        seedTicketId={ticketId}
        seedTitle={ticketSubject}
        seedDescription={ticketDescription ?? undefined}
      />
    </Card>
  );
}

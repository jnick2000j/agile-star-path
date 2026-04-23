import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const TYPES = ["any", "support", "incident", "service_request", "question", "problem"];

export function SLAPoliciesManager() {
  const { currentOrganization } = useOrganization();
  const [policies, setPolicies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>({
    priority: "medium",
    ticket_type: "any",
    response_minutes: 240,
    resolution_minutes: 2880,
  });

  const load = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from("helpdesk_sla_policies")
      .select("*")
      .eq("organization_id", currentOrganization.id)
      .order("priority");
    setPolicies(data ?? []);
  };

  useEffect(() => {
    load();
  }, [currentOrganization?.id]);

  const handleSave = async () => {
    if (!currentOrganization?.id) return;
    const { error } = await supabase.from("helpdesk_sla_policies").upsert(
      {
        organization_id: currentOrganization.id,
        priority: draft.priority,
        ticket_type: draft.ticket_type === "any" ? null : draft.ticket_type,
        response_minutes: Number(draft.response_minutes),
        resolution_minutes: Number(draft.resolution_minutes),
      },
      { onConflict: "organization_id,ticket_type,priority" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("SLA policy saved");
    setOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this SLA policy?")) return;
    const { error } = await supabase.from("helpdesk_sla_policies").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Helpdesk SLA Policies</h3>
          <p className="text-sm text-muted-foreground">
            Define response and resolution targets per priority and ticket type. Defaults apply when no policy is configured.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Policy</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>SLA Policy</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ticket Type</Label>
                  <Select value={draft.ticket_type} onValueChange={(v) => setDraft({ ...draft, ticket_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((p) => <SelectItem key={p} value={p}>{p.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Response (minutes)</Label>
                  <Input type="number" value={draft.response_minutes}
                    onChange={(e) => setDraft({ ...draft, response_minutes: e.target.value })} />
                </div>
                <div>
                  <Label>Resolution (minutes)</Label>
                  <Input type="number" value={draft.resolution_minutes}
                    onChange={(e) => setDraft({ ...draft, resolution_minutes: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Policy</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Priority</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Response</TableHead>
            <TableHead>Resolution</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {policies.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">
              No custom policies. Defaults apply: Urgent 1h/4h, High 4h/24h, Medium 8h/48h, Low 24h/120h.
            </TableCell></TableRow>
          ) : policies.map((p) => (
            <TableRow key={p.id}>
              <TableCell><Badge variant="outline" className="capitalize">{p.priority}</Badge></TableCell>
              <TableCell className="text-sm">{p.ticket_type ? p.ticket_type.replace("_", " ") : "Any"}</TableCell>
              <TableCell className="text-sm">{p.response_minutes} min</TableCell>
              <TableCell className="text-sm">{p.resolution_minutes} min</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

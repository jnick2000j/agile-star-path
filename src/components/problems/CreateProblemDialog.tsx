import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fromTicketId?: string;
  initialTitle?: string;
  initialDescription?: string;
  onCreated?: (problemId: string) => void;
}

export function CreateProblemDialog({ open, onOpenChange, fromTicketId, initialTitle, initialDescription, onCreated }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(initialTitle ?? ""); setDescription(initialDescription ?? ""); setPriority("medium"); setCategory(""); };

  const handleCreate = async () => {
    if (!currentOrganization?.id || !title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("problems")
      .insert({
        organization_id: currentOrganization.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        category: category.trim() || null,
        reporter_user_id: user?.id ?? null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) { setSaving(false); toast.error(error.message); return; }

    // If created from a ticket, link that ticket as the source incident
    if (fromTicketId) {
      await supabase.from("helpdesk_tickets").update({ parent_problem_id: data.id }).eq("id", fromTicketId);
    }
    setSaving(false);
    toast.success("Problem record created");
    qc.invalidateQueries({ queryKey: ["problems"] });
    if (fromTicketId) qc.invalidateQueries({ queryKey: ["hd-ticket", fromTicketId] });
    reset();
    onOpenChange(false);
    onCreated?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New problem record</DialogTitle>
          <DialogDescription>
            {fromTicketId ? "This ticket will be linked as the originating incident." : "Group related incidents and track root cause analysis."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Concise problem statement" /></div>
          <div><Label>Description</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low","medium","high","critical"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Network, Database" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create problem"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

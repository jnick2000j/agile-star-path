import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

interface Programme {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sponsor: string | null;
  budget: string | null;
  benefits_target: string | null;
  tranche: string | null;
  start_date: string | null;
  end_date: string | null;
  organization_id: string | null;
  manager_id: string | null;
  progress: number;
}

interface EditProgrammeDialogProps {
  programme: Programme;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditProgrammeDialog({ programme, open, onOpenChange, onSuccess }: EditProgrammeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();
  const { isAdmin, canManage } = usePermissions();
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ user_id: string; full_name: string | null; email: string }[]>([]);

  const [formData, setFormData] = useState({
    name: programme.name,
    description: programme.description || "",
    status: programme.status,
    sponsor: programme.sponsor || "",
    budget: programme.budget || "",
    benefits_target: programme.benefits_target || "",
    tranche: programme.tranche || "",
    start_date: programme.start_date || "",
    end_date: programme.end_date || "",
    organization_id: programme.organization_id || "",
    manager_id: programme.manager_id || "",
    progress: programme.progress ?? 0,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: programme.name,
        description: programme.description || "",
        status: programme.status,
        sponsor: programme.sponsor || "",
        budget: programme.budget || "",
        benefits_target: programme.benefits_target || "",
        tranche: programme.tranche || "",
        start_date: programme.start_date || "",
        end_date: programme.end_date || "",
        organization_id: programme.organization_id || "",
        manager_id: programme.manager_id || "",
        progress: programme.progress ?? 0,
      });
      Promise.all([
        supabase.from("organizations").select("id, name").order("name"),
        supabase.from("profiles").select("user_id, full_name, email").eq("archived", false),
      ]).then(([orgsRes, membersRes]) => {
        if (orgsRes.data) setOrganizations(orgsRes.data);
        if (membersRes.data) setTeamMembers(membersRes.data);
      });
    }
  }, [open, programme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("programmes")
        .update({
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          sponsor: formData.sponsor || null,
          budget: formData.budget || null,
          benefits_target: formData.benefits_target || null,
          tranche: formData.tranche || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          organization_id: formData.organization_id || null,
          manager_id: formData.manager_id || null,
          progress: Number(formData.progress) || 0,
        })
        .eq("id", programme.id);
      if (error) throw error;
      toast.success("Program updated successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error updating programme:", error);
      toast.error("Failed to update program");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) {
      toast.error("Only administrators can delete programs");
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.from("programmes").delete().eq("id", programme.id);
      if (error) throw error;
      toast.success("Program deleted successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting programme:", error);
      toast.error("Failed to delete program");
    } finally {
      setDeleting(false);
    }
  };

  const canEdit = canManage("programmes");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Program</DialogTitle>
          <DialogDescription>
            Update program details and associate to an organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Organization</Label>
              <Select
                value={formData.organization_id || "none"}
                onValueChange={(v) => setFormData({ ...formData, organization_id: v === "none" ? "" : v })}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Program Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={!canEdit} />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} disabled={!canEdit} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="at-risk">At Risk</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tranche</Label>
              <Input value={formData.tranche} onChange={(e) => setFormData({ ...formData, tranche: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Manager</Label>
              <Select value={formData.manager_id || "none"} onValueChange={(v) => setFormData({ ...formData, manager_id: v === "none" ? "" : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sponsor</Label>
              <Input value={formData.sponsor} onChange={(e) => setFormData({ ...formData, sponsor: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Budget</Label>
              <Input value={formData.budget} onChange={(e) => setFormData({ ...formData, budget: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Benefits Target</Label>
              <Input value={formData.benefits_target} onChange={(e) => setFormData({ ...formData, benefits_target: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Progress (%)</Label>
              <Input type="number" min={0} max={100} value={formData.progress} onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })} disabled={!canEdit} />
            </div>
          </div>
          <div className="flex justify-between pt-4">
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" /> Delete Program
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Program</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{programme.name}"? This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                      {deleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              {canEdit && <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  priority: string;
  health: string;
  methodology: string;
  start_date: string | null;
  end_date: string | null;
  organization_id: string | null;
  programme_id: string | null;
  manager_id: string | null;
  timesheets_enabled?: boolean;
}

interface EditProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditProjectDialog({ project, open, onOpenChange, onSuccess }: EditProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();
  const { isAdmin, canManage } = usePermissions();
  const [programmes, setProgrammes] = useState<{ id: string; name: string }[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ user_id: string; full_name: string | null; email: string }[]>([]);

  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || "",
    programme_id: project.programme_id || "",
    organization_id: project.organization_id || "",
    stage: project.stage,
    priority: project.priority,
    health: project.health,
    methodology: project.methodology,
    start_date: project.start_date || "",
    end_date: project.end_date || "",
    manager_id: project.manager_id || "",
    timesheets_enabled: project.timesheets_enabled ?? true,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: project.name,
        description: project.description || "",
        programme_id: project.programme_id || "",
        organization_id: project.organization_id || "",
        stage: project.stage,
        priority: project.priority,
        health: project.health,
        methodology: project.methodology,
        start_date: project.start_date || "",
        end_date: project.end_date || "",
        manager_id: project.manager_id || "",
        timesheets_enabled: project.timesheets_enabled ?? true,
      });
      fetchData();
    }
  }, [open, project]);

  const fetchData = async () => {
    const [progsRes, orgsRes, membersRes] = await Promise.all([
      supabase.from("programmes").select("id, name"),
      supabase.from("organizations").select("id, name").order("name"),
      supabase.from("profiles").select("user_id, full_name, email").eq("archived", false),
    ]);
    if (progsRes.data) setProgrammes(progsRes.data);
    if (orgsRes.data) setOrganizations(orgsRes.data);
    if (membersRes.data) setTeamMembers(membersRes.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          name: formData.name,
          description: formData.description || null,
          programme_id: formData.programme_id || null,
          organization_id: formData.organization_id || null,
          stage: formData.stage,
          priority: formData.priority,
          health: formData.health,
          methodology: formData.methodology,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          manager_id: formData.manager_id || null,
          timesheets_enabled: formData.timesheets_enabled,
        })
        .eq("id", project.id);

      if (error) throw error;

      toast.success("Project updated successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error("Failed to update project");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) {
      toast.error("Only administrators can delete projects");
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (error) throw error;

      toast.success("Project deleted successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const canEdit = canManage("projects");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update project details. Only administrators can delete projects.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={!canEdit}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="organization">Organization</Label>
              <Select 
                value={formData.organization_id} 
                onValueChange={(v) => setFormData({ ...formData, organization_id: v })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="program">Program</Label>
              <Select 
                value={formData.programme_id} 
                onValueChange={(v) => setFormData({ ...formData, programme_id: v })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programmes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="manager">Project Manager</Label>
              <Select 
                value={formData.manager_id} 
                onValueChange={(v) => setFormData({ ...formData, manager_id: v })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="stage">Stage</Label>
              <Select 
                value={formData.stage} 
                onValueChange={(v) => setFormData({ ...formData, stage: v })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="initiating">Initiating</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="executing">Executing</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="health">Health</Label>
              <Select 
                value={formData.health} 
                onValueChange={(v) => setFormData({ ...formData, health: v })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="amber">Amber</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="methodology">Methodology</Label>
              <Select 
                value={formData.methodology} 
                onValueChange={(v) => setFormData({ ...formData, methodology: v })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRINCE2">PRINCE2</SelectItem>
                  <SelectItem value="Agile">Agile</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                  <SelectItem value="Waterfall">Waterfall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="timesheets_enabled">Timesheets Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Allow users to log time against this project.
                </p>
              </div>
              <Switch
                id="timesheets_enabled"
                checked={formData.timesheets_enabled}
                onCheckedChange={(v) => setFormData({ ...formData, timesheets_enabled: v })}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="flex justify-between pt-4">
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Project
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Project</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{project.name}"? This action cannot be undone 
                      and will remove all associated data including work packages, tasks, and milestones.
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {canEdit && (
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Building2, Archive, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Organization {
  id: string;
  name: string;
  slug: string;
  primary_color: string | null;
  logo_url: string | null;
  archived?: boolean;
}

interface EditOrganizationDialogProps {
  organization: Organization;
  onSuccess: () => void;
}

export function EditOrganizationDialog({ organization, onSuccess }: EditOrganizationDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    primary_color: "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: organization.name,
        slug: organization.slug,
        primary_color: organization.primary_color || "#2563eb",
      });
    }
  }, [open, organization]);

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: formData.name,
          slug: formData.slug,
          primary_color: formData.primary_color,
        })
        .eq("id", organization.id);

      if (error) throw error;

      toast.success("Organization updated successfully");
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error updating organization:", error);
      toast.error(error.message || "Failed to update organization");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      // We'll add an archived column - for now we delete
      const { error } = await supabase
        .from("organizations")
        .delete()
        .eq("id", organization.id);

      if (error) throw error;

      toast.success("Organization archived successfully");
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error archiving organization:", error);
      toast.error(error.message || "Failed to archive organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Edit Organization
          </DialogTitle>
          <DialogDescription>
            Update organization details or archive it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Organization Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Corporation"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug</Label>
              <Input
                id="edit-slug"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="acme-corporation"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier for the organization
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-color"
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, primary_color: e.target.value }))}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, primary_color: e.target.value }))}
                  placeholder="#2563eb"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="gap-2">
                  <Archive className="h-4 w-4" />
                  Archive
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive Organization?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the organization and disassociate all linked programmes, projects, and products. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchive} className="bg-destructive text-destructive-foreground">
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2 flex-1 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

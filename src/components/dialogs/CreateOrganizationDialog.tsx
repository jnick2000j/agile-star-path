import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrgOnboardingWizard } from "@/components/admin/OrgOnboardingWizard";

interface CreateOrganizationDialogProps {
  onSuccess: () => void;
}

interface VerticalOpt {
  id: string;
  name: string;
}

export function CreateOrganizationDialog({ onSuccess }: CreateOrganizationDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    industry_vertical: "",
  });
  const [verticals, setVerticals] = useState<VerticalOpt[]>([]);
  const [createdOrg, setCreatedOrg] = useState<{ id: string; name: string; slug: string; industry_vertical: string } | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Load enabled verticals so admins pick from active industries only.
  useEffect(() => {
    if (!open) return;
    supabase
      .from("industry_verticals")
      .select("id, name, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        const list = (data ?? []).map((v: any) => ({ id: v.id, name: v.name }));
        setVerticals(list);
        setFormData((prev) => ({
          ...prev,
          industry_vertical: prev.industry_vertical || list[0]?.id || "",
        }));
      });
  }, [open]);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({ ...prev, name, slug: generateSlug(name) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: formData.name,
          slug: formData.slug,
          created_by: user.id,
          industry_vertical: formData.industry_vertical || null,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      const { error: accessError } = await supabase
        .from("user_organization_access")
        .insert({
          user_id: user.id,
          organization_id: org.id,
          access_level: "admin",
        });

      if (accessError) throw accessError;

      await supabase.from("branding_settings").insert({ organization_id: org.id });

      toast.success("Organization created — let's get it set up.");
      setCreatedOrg({
        id: org.id,
        name: org.name,
        slug: org.slug,
        industry_vertical: formData.industry_vertical,
      });
      setOpen(false);
      // Launch the same setup wizard the platform admin / first-time onboarding uses
      setShowWizard(true);
      setFormData({ name: "", slug: "", industry_vertical: "" });
    } catch (error: any) {
      console.error("Error creating organization:", error);
      toast.error(error.message || "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  const handleWizardClose = (next: boolean) => {
    setShowWizard(next);
    if (!next) {
      // Wizard was finished or dismissed — refresh parent list.
      onSuccess();
      setCreatedOrg(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Organization
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Create Organization
            </DialogTitle>
            <DialogDescription>
              After creation, a quick setup wizard will configure terminology, modules and starter dashboards for the chosen industry.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Acme Corporation"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="acme-corporation"
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier for the organization
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vertical">Industry vertical *</Label>
                {verticals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No industry verticals are currently enabled. Ask a platform administrator to enable one.
                  </p>
                ) : (
                  <Select
                    value={formData.industry_vertical}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, industry_vertical: v }))}
                  >
                    <SelectTrigger id="vertical">
                      <SelectValue placeholder="Select an industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {verticals.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  Drives the terminology, modules and dashboards applied by the setup wizard.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !formData.industry_vertical}>
                {loading ? "Creating..." : "Create & Launch Setup"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {createdOrg && (
        <OrgOnboardingWizard
          open={showWizard}
          onOpenChange={handleWizardClose}
          organization={createdOrg}
          verticalId={createdOrg.industry_vertical}
          onSuccess={() => handleWizardClose(false)}
        />
      )}
    </>
  );
}

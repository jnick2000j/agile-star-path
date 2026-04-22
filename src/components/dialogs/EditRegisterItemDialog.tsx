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
import { BenefitProfilePanel } from "@/components/workflow/BenefitProfilePanel";
import { RemediationTasksPanel } from "@/components/workflow/RemediationTasksPanel";
import { EntityLinksFields } from "@/components/EntityLinksFields";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type RegisterType = "risks" | "issues" | "benefits" | "stakeholders";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RegisterItem = any;

interface EditRegisterItemDialogProps {
  item: RegisterItem;
  type: RegisterType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const typeConfig: Record<RegisterType, { 
  title: string;
  permissionKey: string;
  fields: { key: string; label: string; type: "text" | "textarea" | "select" | "date"; options?: { value: string; label: string }[] }[];
}> = {
  risks: {
    title: "Risk",
    permissionKey: "risks",
    fields: [
      { key: "title", label: "Risk Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "category", label: "Category", type: "select", options: [
        { value: "Resource", label: "Resource" },
        { value: "Technical", label: "Technical" },
        { value: "Compliance", label: "Compliance" },
        { value: "Financial", label: "Financial" },
        { value: "Stakeholder", label: "Stakeholder" },
        { value: "Quality", label: "Quality" },
        { value: "Commercial", label: "Commercial" },
      ]},
      { key: "probability", label: "Probability", type: "select", options: [
        { value: "very-low", label: "Very Low" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "very-high", label: "Very High" },
      ]},
      { key: "impact", label: "Impact", type: "select", options: [
        { value: "very-low", label: "Very Low" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "very-high", label: "Very High" },
      ]},
      { key: "status", label: "Status", type: "select", options: [
        { value: "open", label: "Open" },
        { value: "mitigating", label: "Mitigating" },
        { value: "closed", label: "Closed" },
        { value: "accepted", label: "Accepted" },
      ]},
      { key: "response", label: "Response Strategy", type: "textarea" },
      { key: "review_date", label: "Review Date", type: "date" },
    ],
  },
  issues: {
    title: "Issue",
    permissionKey: "issues",
    fields: [
      { key: "title", label: "Issue Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "type", label: "Type", type: "select", options: [
        { value: "problem", label: "Problem" },
        { value: "concern", label: "Concern" },
        { value: "change-request", label: "Change Request" },
        { value: "off-specification", label: "Off-Specification" },
      ]},
      { key: "priority", label: "Priority", type: "select", options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "critical", label: "Critical" },
      ]},
      { key: "status", label: "Status", type: "select", options: [
        { value: "open", label: "Open" },
        { value: "investigating", label: "Investigating" },
        { value: "pending", label: "Pending" },
        { value: "resolved", label: "Resolved" },
        { value: "closed", label: "Closed" },
      ]},
      { key: "target_date", label: "Target Date", type: "date" },
      { key: "resolution", label: "Resolution", type: "textarea" },
    ],
  },
  benefits: {
    title: "Benefit",
    permissionKey: "benefits",
    fields: [
      { key: "name", label: "Benefit Name", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "category", label: "Category", type: "select", options: [
        { value: "financial", label: "Financial" },
        { value: "operational", label: "Operational" },
        { value: "strategic", label: "Strategic" },
        { value: "compliance", label: "Compliance" },
        { value: "customer", label: "Customer" },
      ]},
      { key: "type", label: "Type", type: "select", options: [
        { value: "quantitative", label: "Quantitative" },
        { value: "qualitative", label: "Qualitative" },
      ]},
      { key: "target_value", label: "Target Value", type: "text" },
      { key: "current_value", label: "Current Value", type: "text" },
      { key: "status", label: "Status", type: "select", options: [
        { value: "identified", label: "Identified" },
        { value: "measuring", label: "Measuring" },
        { value: "realized", label: "Realized" },
        { value: "sustaining", label: "Sustaining" },
      ]},
      { key: "start_date", label: "Start Date", type: "date" },
      { key: "end_date", label: "End Date", type: "date" },
    ],
  },
  stakeholders: {
    title: "Stakeholder",
    permissionKey: "stakeholders",
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "role", label: "Role", type: "text" },
      { key: "organization", label: "Organization", type: "text" },
      { key: "influence", label: "Influence", type: "select", options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ]},
      { key: "interest", label: "Interest", type: "select", options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ]},
      { key: "engagement", label: "Engagement", type: "select", options: [
        { value: "champion", label: "Champion" },
        { value: "supporter", label: "Supporter" },
        { value: "neutral", label: "Neutral" },
        { value: "critic", label: "Critic" },
        { value: "blocker", label: "Blocker" },
      ]},
      { key: "communication_frequency", label: "Communication", type: "select", options: [
        { value: "weekly", label: "Weekly" },
        { value: "bi-weekly", label: "Bi-weekly" },
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
      ]},
    ],
  },
};

export function EditRegisterItemDialog({ item, type, open, onOpenChange, onSuccess }: EditRegisterItemDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();
  const { isAdmin, canManage } = usePermissions();
  const [formData, setFormData] = useState<Record<string, string>>({});

  const config = typeConfig[type];

  const [links, setLinks] = useState({ programmeId: "", projectId: "", productId: "" });

  useEffect(() => {
    if (open) {
      const initialData: Record<string, string> = {};
      config.fields.forEach((field) => {
        initialData[field.key] = (item[field.key] as string) || "";
      });
      setFormData(initialData);
      setLinks({
        programmeId: (item.programme_id as string) || "",
        projectId: (item.project_id as string) || "",
        productId: (item.product_id as string) || "",
      });
    }
  }, [open, item, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const updateData: Record<string, unknown> = {};
      config.fields.forEach((field) => {
        updateData[field.key] = formData[field.key] || null;
      });

      // Entity association edits (risks, issues, benefits)
      if (type === "risks" || type === "issues" || type === "benefits") {
        updateData.programme_id = links.programmeId || null;
        updateData.project_id = links.projectId || null;
        updateData.product_id = links.productId || null;
      }

      // Calculate score for risks
      if (type === "risks") {
        const probValues: Record<string, number> = { "very-low": 1, low: 2, medium: 3, high: 4, "very-high": 5 };
        const prob = probValues[formData.probability] || 3;
        const imp = probValues[formData.impact] || 3;
        updateData.score = prob * imp;
      }

      const { error } = await supabase
        .from(type)
        .update(updateData)
        .eq("id", item.id);

      if (error) throw error;

      toast.success(`${config.title} updated successfully`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error(`Error updating ${type}:`, error);
      toast.error(`Failed to update ${config.title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) {
      toast.error(`Only administrators can delete ${config.title.toLowerCase()}s`);
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from(type)
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      toast.success(`${config.title} deleted successfully`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      toast.error(`Failed to delete ${config.title.toLowerCase()}`);
    } finally {
      setDeleting(false);
    }
  };

  const canEdit = canManage(config.permissionKey);
  const itemName = (item.title || item.name || "this item") as string;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {config.title}</DialogTitle>
          <DialogDescription>
            Update {config.title.toLowerCase()} details. Only administrators can delete.
          </DialogDescription>
        </DialogHeader>
        {type === "benefits" ? (
          <Tabs defaultValue="details" className="mt-2">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="profile">Profile & Trajectory</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4">
              <EditForm
                config={config}
                formData={formData}
                setFormData={setFormData}
                canEdit={canEdit}
                handleSubmit={handleSubmit}
                onOpenChange={onOpenChange}
                isAdmin={isAdmin}
                handleDelete={handleDelete}
                deleting={deleting}
                loading={loading}
                itemName={itemName}
              />
            </TabsContent>
            <TabsContent value="profile" className="mt-4">
              <BenefitProfilePanel
                benefitId={item.id}
                organizationId={item.organization_id ?? null}
              />
            </TabsContent>
          </Tabs>
        ) : type === "risks" || type === "issues" ? (
          <Tabs defaultValue="details" className="mt-2">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="remediation">Remediation Tasks</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4">
              <EditForm
                config={config}
                formData={formData}
                setFormData={setFormData}
                canEdit={canEdit}
                handleSubmit={handleSubmit}
                onOpenChange={onOpenChange}
                isAdmin={isAdmin}
                handleDelete={handleDelete}
                deleting={deleting}
                loading={loading}
                itemName={itemName}
              />
            </TabsContent>
            <TabsContent value="remediation" className="mt-4">
              <RemediationTasksPanel
                parent={{
                  kind: type === "risks" ? "risk" : "issue",
                  id: item.id,
                  organizationId: item.organization_id,
                  programmeId: item.programme_id,
                  projectId: item.project_id,
                  productId: item.product_id,
                }}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <EditForm
            config={config}
            formData={formData}
            setFormData={setFormData}
            canEdit={canEdit}
            handleSubmit={handleSubmit}
            onOpenChange={onOpenChange}
            isAdmin={isAdmin}
            handleDelete={handleDelete}
            deleting={deleting}
            loading={loading}
            itemName={itemName}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditFormProps {
  config: any;
  formData: any;
  setFormData: (d: any) => void;
  canEdit: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  handleDelete: () => void;
  deleting: boolean;
  loading: boolean;
  itemName: string;
}

function EditForm({
  config,
  formData,
  setFormData,
  canEdit,
  handleSubmit,
  onOpenChange,
  isAdmin,
  handleDelete,
  deleting,
  loading,
  itemName,
}: EditFormProps) {
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {config.fields.map((field: any) => (
          <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
            <Label htmlFor={field.key}>{field.label}</Label>
            {field.type === "text" && (
              <Input
                id={field.key}
                value={formData[field.key] || ""}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                disabled={!canEdit}
              />
            )}
            {field.type === "textarea" && (
              <Textarea
                id={field.key}
                value={formData[field.key] || ""}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                rows={3}
                disabled={!canEdit}
              />
            )}
            {field.type === "date" && (
              <Input
                id={field.key}
                type="date"
                value={formData[field.key] || ""}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                disabled={!canEdit}
              />
            )}
            {field.type === "select" && field.options && (
              <Select
                value={formData[field.key] || ""}
                onValueChange={(v) => setFormData({ ...formData, [field.key]: v })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-4">
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {config.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{itemName}"? This action cannot be undone.
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
  );
}

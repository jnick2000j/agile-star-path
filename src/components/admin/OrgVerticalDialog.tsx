import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Org {
  id: string;
  name: string;
  slug: string;
  industry_vertical?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Org | null;
  onSuccess?: () => void;
}

export function OrgVerticalDialog({ open, onOpenChange, organization, onSuccess }: Props) {
  const [verticals, setVerticals] = useState<Array<{ id: string; name: string; description: string | null }>>([]);
  const [selected, setSelected] = useState<string>("technology");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("industry_verticals")
      .select("id, name, description")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setVerticals(data || []));
  }, [open]);

  useEffect(() => {
    if (organization) setSelected(organization.industry_vertical || "technology");
  }, [organization]);

  const save = async () => {
    if (!organization) return;
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({ industry_vertical: selected })
      .eq("id", organization.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Vertical updated for ${organization.name}`);
    onSuccess?.();
    onOpenChange(false);
  };

  const current = verticals.find((v) => v.id === selected);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Industry Vertical</DialogTitle>
          <DialogDescription>
            {organization ? `Assign a vertical pack to ${organization.name}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Vertical</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {verticals.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {current?.description && (
            <p className="text-sm text-muted-foreground">{current.description}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

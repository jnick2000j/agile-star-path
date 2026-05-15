import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface CreateOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (orgId: string) => void;
}

export function CreateOrgDialog({ open, onOpenChange, onCreated }: CreateOrgDialogProps) {
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState<string>("none");
  const [joinAsAdmin, setJoinAsAdmin] = useState(true);
  const [verticals, setVerticals] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setVertical("none");
    setJoinAsAdmin(true);
    supabase
      .from("industry_verticals")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setVerticals(data ?? []));
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Organization name is required");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("platform_admin_create_organization", {
        _org_name: name.trim(),
        _industry_vertical: vertical === "none" ? null : vertical,
        _join_as_admin: joinAsAdmin,
      });
      if (error) throw error;
      toast.success(`Organization "${name.trim()}" created`);
      onOpenChange(false);
      if (data) onCreated?.(data as string);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create organization");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            Provision a new tenant. A trialing subscription and default branding settings will be created automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Industry vertical (optional)</Label>
            <Select value={vertical} onValueChange={setVertical}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {verticals.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 rounded-md border p-3 bg-muted/30">
            <Checkbox
              id="join-admin"
              checked={joinAsAdmin}
              onCheckedChange={(c) => setJoinAsAdmin(c === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="join-admin" className="cursor-pointer">
                Add me as an admin of this organization
              </Label>
              <p className="text-xs text-muted-foreground">
                Recommended so you can manage the org without re-impersonating. Uncheck to create the org without joining.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create organization"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Feature {
  id: string;
  feature_key: string;
  name: string;
  description: string | null;
  category: string;
  feature_type: string;
  default_value: any;
  display_order: number;
  is_active: boolean;
}

const blank: Partial<Feature> = {
  feature_key: "",
  name: "",
  description: "",
  category: "general",
  feature_type: "boolean",
  default_value: false,
  display_order: 0,
  is_active: true,
};

export function FeatureCatalogManager() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Feature> | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("plan_features")
      .select("*")
      .order("category")
      .order("display_order");
    setFeatures((data || []) as Feature[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!editing?.feature_key || !editing?.name) {
      toast.error("Key and name are required");
      return;
    }
    const payload = {
      feature_key: editing.feature_key.trim(),
      name: editing.name,
      description: editing.description || null,
      category: editing.category || "general",
      feature_type: editing.feature_type || "boolean",
      default_value:
        editing.feature_type === "numeric"
          ? Number(editing.default_value ?? 0)
          : editing.feature_type === "boolean"
            ? editing.default_value === true || editing.default_value === "true"
            : editing.default_value,
      display_order: editing.display_order ?? 0,
      is_active: editing.is_active ?? true,
    };
    try {
      if (editing.id) {
        const { error } = await supabase
          .from("plan_features")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plan_features").insert(payload);
        if (error) throw error;
      }
      toast.success("Feature saved");
      setOpen(false);
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this feature? Plan values referencing it will also be removed.")) return;
    const { error } = await supabase.from("plan_features").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Feature deleted");
    load();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Feature catalog</h3>
          <p className="text-sm text-muted-foreground">
            Add or edit feature keys that plans can grant to organizations.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(blank)}>
              <Plus className="h-4 w-4 mr-2" />
              New feature
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit feature" : "New feature"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Feature key</Label>
                  <Input
                    placeholder="feature_my_thing"
                    value={editing?.feature_key || ""}
                    disabled={!!editing?.id}
                    onChange={(e) => setEditing({ ...editing!, feature_key: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={editing?.category || ""}
                    onChange={(e) => setEditing({ ...editing!, category: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Display name</Label>
                <Input
                  value={editing?.name || ""}
                  onChange={(e) => setEditing({ ...editing!, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editing?.description || ""}
                  onChange={(e) => setEditing({ ...editing!, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={editing?.feature_type || "boolean"}
                    onValueChange={(v) => setEditing({ ...editing!, feature_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boolean">Boolean toggle</SelectItem>
                      <SelectItem value="numeric">Numeric limit</SelectItem>
                      <SelectItem value="text">Text value</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Display order</Label>
                  <Input
                    type="number"
                    value={editing?.display_order ?? 0}
                    onChange={(e) => setEditing({ ...editing!, display_order: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Default value</Label>
                  {editing?.feature_type === "boolean" ? (
                    <div className="h-10 flex items-center">
                      <Switch
                        checked={editing?.default_value === true || editing?.default_value === "true"}
                        onCheckedChange={(c) => setEditing({ ...editing!, default_value: c })}
                      />
                    </div>
                  ) : (
                    <Input
                      type={editing?.feature_type === "numeric" ? "number" : "text"}
                      value={editing?.default_value ?? ""}
                      onChange={(e) => setEditing({ ...editing!, default_value: e.target.value })}
                    />
                  )}
                </div>
                <div>
                  <Label>Active</Label>
                  <div className="h-10 flex items-center">
                    <Switch
                      checked={editing?.is_active ?? true}
                      onCheckedChange={(c) => setEditing({ ...editing!, is_active: c })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Default</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={7} className="text-center py-6">Loading…</TableCell></TableRow>
          ) : (
            features.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-mono text-xs">{f.feature_key}</TableCell>
                <TableCell>{f.name}</TableCell>
                <TableCell><Badge variant="outline">{f.category}</Badge></TableCell>
                <TableCell><Badge variant="secondary">{f.feature_type}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{JSON.stringify(f.default_value)}</TableCell>
                <TableCell>
                  {f.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(f); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

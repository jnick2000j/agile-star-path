import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
import { Plus, Pencil, Trash2, FileText, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { MACRO_VARIABLES } from "@/lib/macros";
import { format } from "date-fns";

interface MacroForm {
  id?: string;
  name: string;
  description: string;
  category: string;
  body: string;
  shortcut: string;
  is_shared: boolean;
}

const empty: MacroForm = {
  name: "",
  description: "",
  category: "",
  body: "",
  shortcut: "",
  is_shared: true,
};

export default function MacrosPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<MacroForm | null>(null);
  const [open, setOpen] = useState(false);

  const { data: macros = [], isLoading } = useQuery({
    queryKey: ["helpdesk-macros-mgmt", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_macros")
        .select("*")
        .eq("organization_id", currentOrganization!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const startNew = () => {
    setEditing({ ...empty });
    setOpen(true);
  };
  const startEdit = (m: any) => {
    setEditing({
      id: m.id,
      name: m.name ?? "",
      description: m.description ?? "",
      category: m.category ?? "",
      body: m.body ?? "",
      shortcut: m.shortcut ?? "",
      is_shared: !!m.is_shared,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!editing || !currentOrganization) return;
    if (!editing.name.trim() || !editing.body.trim()) {
      toast.error("Name and body are required");
      return;
    }
    const payload: any = {
      organization_id: currentOrganization.id,
      name: editing.name.trim(),
      description: editing.description.trim() || null,
      category: editing.category.trim() || null,
      body: editing.body,
      shortcut: editing.shortcut.trim() || null,
      is_shared: editing.is_shared,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from("helpdesk_macros").update(payload).eq("id", editing.id));
    } else {
      payload.created_by = user?.id;
      ({ error } = await supabase.from("helpdesk_macros").insert(payload));
    }
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing.id ? "Macro updated" : "Macro created");
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["helpdesk-macros-mgmt"] });
    qc.invalidateQueries({ queryKey: ["helpdesk-macros"] });
  };

  const remove = async (m: any) => {
    const { error } = await supabase.from("helpdesk_macros").delete().eq("id", m.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Macro deleted");
    qc.invalidateQueries({ queryKey: ["helpdesk-macros-mgmt"] });
    qc.invalidateQueries({ queryKey: ["helpdesk-macros"] });
  };

  const insertVariable = (token: string) => {
    if (!editing) return;
    setEditing({ ...editing, body: editing.body + token });
  };

  const body = (
    <div className={embedded ? "space-y-6" : "p-6 space-y-6 max-w-7xl mx-auto"}>
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <FileText className="h-6 w-6" /> Macros & Canned Responses
            </h1>
            <p className="text-sm text-muted-foreground">
              Reusable reply templates with variable substitution and shortcuts.
            </p>
          </div>
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-2" /> New Macro
          </Button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && macros.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            No macros yet. Click <strong>New Macro</strong> to create your first one.
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {macros.map((m: any) => (
            <Card key={m.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{m.name}</h3>
                  {m.description && (
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete macro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{m.name}" will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(m)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {m.shortcut && (
                  <Badge variant="outline" className="font-mono">
                    <Hash className="h-3 w-3 mr-1" />
                    {m.shortcut}
                  </Badge>
                )}
                {m.category && <Badge variant="secondary">{m.category}</Badge>}
                <Badge variant={m.is_shared ? "default" : "outline"}>
                  {m.is_shared ? "Shared" : "Private"}
                </Badge>
              </div>

              <div className="bg-muted/40 rounded p-3 text-sm whitespace-pre-wrap line-clamp-4 font-mono">
                {m.body}
              </div>

              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Used {m.usage_count ?? 0} time{m.usage_count === 1 ? "" : "s"}</span>
                {m.last_used_at && (
                  <span>Last used {format(new Date(m.last_used_at), "PP")}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Macro" : "New Macro"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-3">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Acknowledge ticket received"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    placeholder="Quick acknowledgement reply"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <Input
                      value={editing.category}
                      onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                      placeholder="Support, Billing…"
                    />
                  </div>
                  <div>
                    <Label>Shortcut</Label>
                    <Input
                      value={editing.shortcut}
                      onChange={(e) => setEditing({ ...editing, shortcut: e.target.value })}
                      placeholder="ack, refund"
                    />
                  </div>
                </div>
                <div>
                  <Label>Body *</Label>
                  <Textarea
                    rows={10}
                    value={editing.body}
                    onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                    placeholder="Hi {{customer.first_name}}, thanks for reaching out about {{ticket.subject}}…"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="shared"
                    checked={editing.is_shared}
                    onCheckedChange={(v) => setEditing({ ...editing, is_shared: v })}
                  />
                  <Label htmlFor="shared">Share with all org members</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Insert variable</Label>
                <div className="border rounded p-2 space-y-1 max-h-96 overflow-y-auto">
                  {MACRO_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertVariable(v.token)}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent"
                    >
                      <div className="font-mono text-primary">{v.token}</div>
                      <div className="text-muted-foreground">{v.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing?.id ? "Save changes" : "Create macro"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

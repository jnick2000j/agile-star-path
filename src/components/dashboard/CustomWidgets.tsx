import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CustomWidgetCard, CustomWidget, CustomWidgetType, METRIC_ENTITIES } from "./CustomWidgetCard";

export function CustomWidgets() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomWidget | null>(null);

  const { data: widgets = [] } = useQuery({
    queryKey: ["custom-widgets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_dashboard_widgets")
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as CustomWidget[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (w: Partial<CustomWidget> & { title: string; widget_type: CustomWidgetType; config: any }) => {
      if (!user) throw new Error("Not signed in");
      const payload: any = {
        user_id: user.id,
        title: w.title,
        widget_type: w.widget_type,
        config: w.config,
        position: w.position ?? widgets.length,
      };
      if (w.id) payload.id = w.id;
      const { error } = await supabase.from("user_dashboard_widgets").upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-widgets", user?.id] });
      setOpen(false);
      setEditing(null);
      toast({ title: "Widget saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_dashboard_widgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-widgets", user?.id] }),
  });

  const startCreate = () => { setEditing(null); setOpen(true); };
  const startEdit = (w: CustomWidget) => { setEditing(w); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Widgets</h3>
        <Button size="sm" variant="outline" onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add widget
        </Button>
      </div>

      {widgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom widgets yet. Click <strong>Add widget</strong> to pin a note, link list, or live metric.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {widgets.map((w) => (
            <CustomWidgetCard
              key={w.id}
              widget={w}
              onEdit={startEdit}
              onDelete={(x) => remove.mutate(x.id)}
            />
          ))}
        </div>
      )}

      <WidgetEditor
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSave={(w) => upsert.mutate(w)}
        saving={upsert.isPending}
      />
    </div>
  );
}

function WidgetEditor({
  open, onOpenChange, editing, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: CustomWidget | null;
  onSave: (w: Partial<CustomWidget> & { title: string; widget_type: CustomWidgetType; config: any }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CustomWidgetType>("note");
  const [noteText, setNoteText] = useState("");
  const [links, setLinks] = useState<{ label: string; url: string }[]>([{ label: "", url: "" }]);
  const [entity, setEntity] = useState<string>("projects");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setType(editing.widget_type);
      setNoteText(editing.config?.text || "");
      setLinks(editing.config?.links?.length ? editing.config.links : [{ label: "", url: "" }]);
      setEntity(editing.config?.entity || "projects");
      setStatusFilter(editing.config?.status || "");
    } else {
      setTitle(""); setType("note"); setNoteText("");
      setLinks([{ label: "", url: "" }]);
      setEntity("projects"); setStatusFilter("");
    }
  }, [open, editing]);

  const presetTemplate = (preset: string) => {
    switch (preset) {
      case "my-notes":
        setTitle("My Notes"); setType("note"); setNoteText(""); break;
      case "useful-links":
        setTitle("Useful Links"); setType("links");
        setLinks([{ label: "", url: "" }]); break;
      case "open-risks":
        setTitle("Open Risks"); setType("metric");
        setEntity("risks"); setStatusFilter("open"); break;
      case "open-issues":
        setTitle("Open Issues"); setType("metric");
        setEntity("issues"); setStatusFilter("open"); break;
      case "active-projects":
        setTitle("Active Projects"); setType("metric");
        setEntity("projects"); setStatusFilter("active"); break;
      case "active-programmes":
        setTitle("Active Programmes"); setType("metric");
        setEntity("programmes"); setStatusFilter("active"); break;
      case "my-tasks":
        setTitle("Open Tasks"); setType("metric");
        setEntity("tasks"); setStatusFilter("open"); break;
      case "open-tickets":
        setTitle("Open Helpdesk Tickets"); setType("metric");
        setEntity("helpdesk_tickets"); setStatusFilter("open"); break;
      case "pending-changes":
        setTitle("Pending Changes"); setType("metric");
        setEntity("change_requests"); setStatusFilter("pending"); break;
      case "open-problems":
        setTitle("Open Problems"); setType("metric");
        setEntity("problems"); setStatusFilter("open"); break;
      case "milestones-due":
        setTitle("Upcoming Milestones"); setType("metric");
        setEntity("milestones"); setStatusFilter("upcoming"); break;
      case "open-rfis":
        setTitle("Open RFIs"); setType("metric");
        setEntity("rfis"); setStatusFilter("open"); break;
      case "course-enrollments":
        setTitle("Active Enrollments"); setType("metric");
        setEntity("lms_enrollments"); setStatusFilter("active"); break;
      case "kb-articles":
        setTitle("Published KB Articles"); setType("metric");
        setEntity("kb_articles"); setStatusFilter("published"); break;
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    let config: any = {};
    if (type === "note") config = { text: noteText };
    if (type === "links") config = { links: links.filter(l => l.url.trim()) };
    if (type === "metric") config = { entity, status: statusFilter || undefined };
    onSave({
      id: editing?.id,
      position: editing?.position,
      title: title.trim(),
      widget_type: type,
      config,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit widget" : "Add widget"}</DialogTitle>
        </DialogHeader>

        {!editing && (
          <div>
            <Label className="text-xs text-muted-foreground">Start from a default</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { id: "my-notes", label: "My Notes" },
                { id: "useful-links", label: "Useful Links" },
                { id: "open-risks", label: "Open Risks" },
                { id: "active-projects", label: "Active Projects" },
                { id: "my-tasks", label: "Open Tasks" },
              ].map(p => (
                <Button key={p.id} type="button" variant="secondary" size="sm" onClick={() => presetTemplate(p.id)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label htmlFor="w-title">Title</Label>
            <Input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My widget" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CustomWidgetType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="links">Link list</SelectItem>
                <SelectItem value="metric">Metric counter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "note" && (
            <div>
              <Label htmlFor="w-note">Text</Label>
              <Textarea id="w-note" rows={6} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            </div>
          )}

          {type === "links" && (
            <div className="space-y-2">
              <Label>Links</Label>
              {links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Label"
                    value={l.label}
                    onChange={(e) => {
                      const next = [...links]; next[i] = { ...l, label: e.target.value }; setLinks(next);
                    }}
                  />
                  <Input
                    placeholder="https://…"
                    value={l.url}
                    onChange={(e) => {
                      const next = [...links]; next[i] = { ...l, url: e.target.value }; setLinks(next);
                    }}
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => setLinks(links.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => setLinks([...links, { label: "", url: "" }])}>
                <Plus className="h-4 w-4 mr-1" /> Add link
              </Button>
            </div>
          )}

          {type === "metric" && (
            <>
              <div>
                <Label>Entity</Label>
                <Select value={entity} onValueChange={setEntity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {Array.from(new Set(Object.values(METRIC_ENTITIES).map(v => v.group))).map((group) => (
                      <div key={group}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {group}
                        </div>
                        {Object.entries(METRIC_ENTITIES)
                          .filter(([, v]) => v.group === group)
                          .map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="w-status">Status filter (optional)</Label>
                <Input
                  id="w-status"
                  placeholder="e.g. open, active, mitigating"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank to count all rows you can see.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save widget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

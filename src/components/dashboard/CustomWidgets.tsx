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
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CustomWidgetCard, CustomWidget, CustomWidgetType, METRIC_ENTITIES } from "./CustomWidgetCard";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  arrayMove, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Scope = "portfolio" | "my-work";

interface CustomWidgetsProps {
  scope?: Scope;
  /** Heading shown above the widget grid. Defaults vary per scope. */
  heading?: string;
  /** Hint text shown when the widget list is empty. */
  emptyHint?: string;
  /** When true, new widgets default to "Only mine" filter. */
  defaultMine?: boolean;
}

export function CustomWidgets({
  scope = "portfolio",
  heading,
  emptyHint,
  defaultMine = false,
}: CustomWidgetsProps = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomWidget | null>(null);
  const queryKey = ["custom-widgets", scope, user?.id];

  const { data: widgets = [] } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_dashboard_widgets")
        .select("*")
        .eq("dashboard_scope", scope)
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
        dashboard_scope: scope,
      };
      if (w.id) payload.id = w.id;
      const { error } = await supabase.from("user_dashboard_widgets").upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
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
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const reorder = useMutation({
    mutationFn: async (ordered: CustomWidget[]) => {
      if (!user) throw new Error("Not signed in");
      const rows = ordered.map((w, i) => ({
        id: w.id,
        user_id: user.id,
        title: w.title,
        widget_type: w.widget_type,
        config: w.config,
        position: i,
        dashboard_scope: scope,
      }));
      const { error } = await supabase.from("user_dashboard_widgets").upsert(rows);
      if (error) throw error;
    },
    onError: (e: any) => toast({ title: "Reorder failed", description: e.message, variant: "destructive" }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = widgets.findIndex(w => w.id === active.id);
    const newIndex = widgets.findIndex(w => w.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(widgets, oldIndex, newIndex);
    qc.setQueryData(["custom-widgets", user?.id], next);
    reorder.mutate(next);
  };

  const startCreate = () => { setEditing(null); setOpen(true); };
  const startEdit = (w: CustomWidget) => { setEditing(w); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Dashboard</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Drag the handle on a card to reorder.</p>
        </div>
        <Button size="sm" variant="outline" onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add widget
        </Button>
      </div>

      {widgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No widgets yet. Click <strong>Add widget</strong> to pin a note, link list, or live metric.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {widgets.map((w) => (
                <SortableWidget
                  key={w.id}
                  widget={w}
                  onEdit={startEdit}
                  onDelete={(x) => remove.mutate(x.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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

function SortableWidget({
  widget, onEdit, onDelete,
}: {
  widget: CustomWidget;
  onEdit: (w: CustomWidget) => void;
  onDelete: (w: CustomWidget) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto",
  };
  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="absolute left-1 top-2 z-10 p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <CustomWidgetCard widget={widget} onEdit={onEdit} onDelete={onDelete} />
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

  // Curated quick-start presets covering all platform areas. Each entry maps to
  // an entity already declared in METRIC_ENTITIES so the picker stays in sync.
  const PRESETS: Array<{
    id: string;
    label: string;
    title: string;
    type: CustomWidgetType;
    entity?: string;
    status?: string;
  }> = [
    { id: "my-notes",            label: "My Notes",             title: "My Notes",              type: "note" },
    { id: "useful-links",        label: "Useful Links",         title: "Useful Links",          type: "links" },
    // Delivery
    { id: "active-programmes",   label: "Active Programmes",    title: "Active Programmes",     type: "metric", entity: "programmes",         status: "active" },
    { id: "active-projects",     label: "Active Projects",      title: "Active Projects",       type: "metric", entity: "projects",           status: "active" },
    { id: "active-products",     label: "Active Products",      title: "Active Products",       type: "metric", entity: "products",           status: "active" },
    { id: "open-work-packages",  label: "Open Work Packages",   title: "Open Work Packages",    type: "metric", entity: "work_packages",      status: "open" },
    { id: "milestones-due",      label: "Upcoming Milestones",  title: "Upcoming Milestones",   type: "metric", entity: "milestones",         status: "upcoming" },
    { id: "active-sprints",      label: "Active Sprints",       title: "Active Sprints",        type: "metric", entity: "sprints",            status: "active" },
    { id: "open-stage-gates",    label: "Open Stage Gates",     title: "Open Stage Gates",      type: "metric", entity: "stage_gates",        status: "open" },
    { id: "active-tranches",     label: "Active Tranches",      title: "Active Tranches",       type: "metric", entity: "tranches",           status: "active" },
    // Registers
    { id: "open-risks",          label: "Open Risks",           title: "Open Risks",            type: "metric", entity: "risks",              status: "open" },
    { id: "open-issues",         label: "Open Issues",          title: "Open Issues",           type: "metric", entity: "issues",             status: "open" },
    { id: "open-exceptions",     label: "Open Exceptions",      title: "Open Exceptions",       type: "metric", entity: "exceptions",         status: "open" },
    { id: "stakeholders",        label: "Stakeholders",         title: "Stakeholders",          type: "metric", entity: "stakeholders" },
    { id: "lessons-learned",     label: "Lessons Learned",      title: "Lessons Learned",       type: "metric", entity: "lessons_learned" },
    { id: "benefits",            label: "Benefits",             title: "Benefits",              type: "metric", entity: "benefits" },
    { id: "business-reqs",       label: "Business Requirements",title: "Business Requirements", type: "metric", entity: "business_requirements", status: "open" },
    { id: "technical-reqs",      label: "Technical Requirements", title: "Technical Requirements", type: "metric", entity: "technical_requirements", status: "open" },
    // Tasks & field
    { id: "my-tasks",            label: "Open Tasks",           title: "Open Tasks",            type: "metric", entity: "tasks",              status: "open" },
    { id: "daily-logs",          label: "Daily Logs",           title: "Daily Logs",            type: "metric", entity: "daily_logs" },
    { id: "punch-list",          label: "Open Punch List",      title: "Open Punch List",       type: "metric", entity: "punch_list_items",   status: "open" },
    { id: "open-rfis",           label: "Open RFIs",            title: "Open RFIs",             type: "metric", entity: "rfis",               status: "open" },
    { id: "open-submittals",     label: "Open Submittals",      title: "Open Submittals",       type: "metric", entity: "submittals",         status: "open" },
    // Service Management
    { id: "open-tickets",        label: "Open Tickets",         title: "Open Helpdesk Tickets", type: "metric", entity: "helpdesk_tickets",   status: "open" },
    { id: "pending-changes",     label: "Pending Changes",      title: "Pending Changes",       type: "metric", entity: "change_requests",    status: "pending" },
    { id: "open-problems",       label: "Open Problems",        title: "Open Problems",         type: "metric", entity: "problems",           status: "open" },
    { id: "major-incidents",     label: "Major Incidents",      title: "Major Incidents",       type: "metric", entity: "major_incidents",    status: "open" },
    { id: "config-items",        label: "Configuration Items",  title: "Configuration Items",   type: "metric", entity: "configuration_items" },
    { id: "assets",              label: "Assets",               title: "Assets",                type: "metric", entity: "assets" },
    { id: "asset-contracts",     label: "Asset Contracts",      title: "Active Contracts",      type: "metric", entity: "asset_contracts",    status: "active" },
    // Engagements
    { id: "engagements",         label: "Active Engagements",   title: "Active Engagements",    type: "metric", entity: "client_engagements", status: "active" },
    { id: "retainers",           label: "Active Retainers",     title: "Active Retainers",      type: "metric", entity: "retainers",          status: "active" },
    // Knowledge & Learning
    { id: "kb-articles",         label: "Published KB",         title: "Published KB Articles", type: "metric", entity: "kb_articles",        status: "published" },
    { id: "lms-courses",         label: "Active Courses",       title: "Active Courses",        type: "metric", entity: "lms_courses",        status: "active" },
    { id: "course-enrollments",  label: "Active Enrollments",   title: "Active Enrollments",    type: "metric", entity: "lms_enrollments",    status: "active" },
    { id: "lms-certificates",    label: "Certificates Issued",  title: "Certificates Issued",   type: "metric", entity: "lms_certificates" },
    // Automation & AI
    { id: "ai-insights",         label: "AI Insights",          title: "Open AI Insights",      type: "metric", entity: "ai_insights",        status: "open" },
    { id: "automations",         label: "Automation Workflows", title: "Active Automations",    type: "metric", entity: "automation_workflows", status: "active" },
    { id: "automation-runs",     label: "Recent Automation Runs", title: "Automation Runs",     type: "metric", entity: "automation_runs" },
    // Governance
    { id: "documents",           label: "Documents",            title: "Documents",             type: "metric", entity: "documents" },
    { id: "governance-reports",  label: "Governance Reports",   title: "Governance Reports",    type: "metric", entity: "governance_reports" },
    { id: "compliance",          label: "Compliance",           title: "Compliance Attestations", type: "metric", entity: "compliance_attestations", status: "active" },
    { id: "csat",                label: "CSAT Responses",       title: "CSAT Responses",        type: "metric", entity: "csat_responses" },
  ];

  const presetTemplate = (presetId: string) => {
    const p = PRESETS.find(x => x.id === presetId);
    if (!p) return;
    setTitle(p.title);
    setType(p.type);
    if (p.type === "note") setNoteText("");
    if (p.type === "links") setLinks([{ label: "", url: "" }]);
    if (p.type === "metric") {
      setEntity(p.entity || "projects");
      setStatusFilter(p.status || "");
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
            <div className="flex flex-wrap gap-2 mt-2 max-h-48 overflow-y-auto pr-1">
              {PRESETS.map(p => (
                <Button key={p.id} type="button" variant="secondary" size="sm" onClick={() => presetTemplate(p.id)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Or build your own below — every platform area is in the Entity picker.
            </p>
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

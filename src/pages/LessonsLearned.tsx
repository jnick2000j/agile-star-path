import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Edit2,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DocumentUpload } from "@/components/DocumentUpload";
import { LessonTagsPanel } from "@/components/workflow/LessonTagsPanel";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  lesson_type: string;
  category: string;
  priority: string;
  status: string;
  event_date: string | null;
  project_stage: string | null;
  what_happened: string | null;
  root_cause: string | null;
  recommendation: string | null;
  action_taken: string | null;
  outcome: string | null;
  applicable_to: string[] | null;
  programme_id: string | null;
  project_id: string | null;
  created_at: string;
}

const lessonTypes = [
  { value: "recommendation", label: "Recommendation", icon: Lightbulb, color: "bg-success/10 text-success" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "bg-warning/10 text-warning" },
  { value: "success", label: "Success", icon: CheckCircle2, color: "bg-primary/10 text-primary" },
];

const categories = [
  { value: "process", label: "Process" },
  { value: "technical", label: "Technical" },
  { value: "communication", label: "Communication" },
  { value: "resource", label: "Resource Management" },
  { value: "stakeholder", label: "Stakeholder Management" },
  { value: "risk", label: "Risk Management" },
  { value: "quality", label: "Quality" },
  { value: "schedule", label: "Schedule" },
  { value: "budget", label: "Budget" },
];

const projectStages = [
  { value: "starting_up", label: "Starting Up (SU)" },
  { value: "initiating", label: "Initiating (IP)" },
  { value: "controlling", label: "Controlling a Stage (CS)" },
  { value: "managing_delivery", label: "Managing Product Delivery (MP)" },
  { value: "stage_boundary", label: "Managing Stage Boundary (SB)" },
  { value: "closing", label: "Closing (CP)" },
];

const priorities = [
  { value: "high", label: "High", color: "bg-destructive/10 text-destructive" },
  { value: "medium", label: "Medium", color: "bg-warning/10 text-warning" },
  { value: "low", label: "Low", color: "bg-muted text-muted-foreground" },
];

const statuses = [
  { value: "identified", label: "Identified", color: "bg-info/10 text-info" },
  { value: "under_review", label: "Under Review", color: "bg-warning/10 text-warning" },
  { value: "approved", label: "Approved", color: "bg-success/10 text-success" },
  { value: "implemented", label: "Implemented", color: "bg-primary/10 text-primary" },
  { value: "closed", label: "Closed", color: "bg-muted text-muted-foreground" },
];

export default function LessonsLearned({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    lesson_type: "recommendation",
    category: "process",
    priority: "medium",
    status: "identified",
    event_date: "",
    project_stage: "",
    what_happened: "",
    root_cause: "",
    recommendation: "",
    action_taken: "",
    outcome: "",
  });

  useEffect(() => {
    fetchLessons();
  }, [currentOrganization]);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("lessons_learned")
        .select("*")
        .order("created_at", { ascending: false });

      if (currentOrganization) {
        query = query.eq("organization_id", currentOrganization.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLessons(data || []);
    } catch (error) {
      console.error("Error fetching lessons:", error);
      toast.error("Failed to load lessons");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      if (editingLesson) {
        const { error } = await supabase
          .from("lessons_learned")
          .update({
            ...formData,
            event_date: formData.event_date || null,
            project_stage: formData.project_stage || null,
          })
          .eq("id", editingLesson.id);

        if (error) throw error;
        toast.success("Lesson updated successfully");
      } else {
        const { error } = await supabase
          .from("lessons_learned")
          .insert({
            ...formData,
            event_date: formData.event_date || null,
            project_stage: formData.project_stage || null,
            organization_id: currentOrganization?.id,
            created_by: user?.id,
            owner_id: user?.id,
            identified_by: user?.id,
          });

        if (error) throw error;
        toast.success("Lesson created successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchLessons();
    } catch (error: any) {
      console.error("Error saving lesson:", error);
      toast.error(error.message || "Failed to save lesson");
    }
  };

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setFormData({
      title: lesson.title,
      description: lesson.description || "",
      lesson_type: lesson.lesson_type,
      category: lesson.category,
      priority: lesson.priority,
      status: lesson.status,
      event_date: lesson.event_date || "",
      project_stage: lesson.project_stage || "",
      what_happened: lesson.what_happened || "",
      root_cause: lesson.root_cause || "",
      recommendation: lesson.recommendation || "",
      action_taken: lesson.action_taken || "",
      outcome: lesson.outcome || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lesson?")) return;

    try {
      const { error } = await supabase
        .from("lessons_learned")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Lesson deleted successfully");
      fetchLessons();
    } catch (error: any) {
      console.error("Error deleting lesson:", error);
      toast.error(error.message || "Failed to delete lesson");
    }
  };

  const resetForm = () => {
    setEditingLesson(null);
    setFormData({
      title: "",
      description: "",
      lesson_type: "recommendation",
      category: "process",
      priority: "medium",
      status: "identified",
      event_date: "",
      project_stage: "",
      what_happened: "",
      root_cause: "",
      recommendation: "",
      action_taken: "",
      outcome: "",
    });
  };

  const filteredLessons = lessons.filter((lesson) => {
    const matchesSearch =
      lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lesson.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || lesson.lesson_type === filterType;
    const matchesCategory = filterCategory === "all" || lesson.category === filterCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  const lessonCounts = {
    total: lessons.length,
    recommendation: lessons.filter((l) => l.lesson_type === "recommendation").length,
    warning: lessons.filter((l) => l.lesson_type === "warning").length,
    success: lessons.filter((l) => l.lesson_type === "success").length,
  };

  const content = (
    <>
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{lessonCounts.total}</p>
              <p className="text-sm text-muted-foreground">Total Lessons</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Lightbulb className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{lessonCounts.recommendation}</p>
              <p className="text-sm text-muted-foreground">Recommendations</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{lessonCounts.warning}</p>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{lessonCounts.success}</p>
              <p className="text-sm text-muted-foreground">Successes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {lessonTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Lesson
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingLesson ? "Edit Lesson" : "Add Lesson Learned"}</DialogTitle>
                <DialogDescription>
                  Capture lessons following PRINCE2 standards for knowledge management.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lesson_type">Type</Label>
                    <Select value={formData.lesson_type} onValueChange={(v) => setFormData({ ...formData, lesson_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {lessonTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event_date">Event Date</Label>
                    <Input
                      id="event_date"
                      type="date"
                      value={formData.event_date}
                      onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_stage">Project Stage</Label>
                    <Select value={formData.project_stage} onValueChange={(v) => setFormData({ ...formData, project_stage: v })}>
                      <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                      <SelectContent>
                        {projectStages.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="what_happened">What Happened?</Label>
                  <Textarea
                    id="what_happened"
                    value={formData.what_happened}
                    onChange={(e) => setFormData({ ...formData, what_happened: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="root_cause">Root Cause</Label>
                  <Textarea
                    id="root_cause"
                    value={formData.root_cause}
                    onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recommendation">Recommendation</Label>
                  <Textarea
                    id="recommendation"
                    value={formData.recommendation}
                    onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="action_taken">Action Taken</Label>
                    <Textarea
                      id="action_taken"
                      value={formData.action_taken}
                      onChange={(e) => setFormData({ ...formData, action_taken: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outcome">Outcome</Label>
                    <Textarea
                      id="outcome"
                      value={formData.outcome}
                      onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                {editingLesson && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label>Tags</Label>
                    <LessonTagsPanel
                      lessonId={editingLesson.id}
                      organizationId={currentOrganization?.id ?? null}
                    />
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingLesson ? "Update Lesson" : "Add Lesson"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lessons Table */}
      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lesson</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading lessons...
                </TableCell>
              </TableRow>
            ) : filteredLessons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No lessons found. Start capturing lessons from your projects.
                </TableCell>
              </TableRow>
            ) : (
              filteredLessons.map((lesson, index) => {
                const typeConfig = lessonTypes.find((t) => t.value === lesson.lesson_type);
                const priorityConfig = priorities.find((p) => p.value === lesson.priority);
                const statusConfig = statuses.find((s) => s.value === lesson.status);
                const stageConfig = projectStages.find((s) => s.value === lesson.project_stage);
                const TypeIcon = typeConfig?.icon || Lightbulb;

                return (
                  <TableRow key={lesson.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="font-medium truncate">{lesson.title}</p>
                        {lesson.description && (
                          <p className="text-xs text-muted-foreground truncate">{lesson.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("gap-1", typeConfig?.color)}>
                        <TypeIcon className="h-3 w-3" />
                        {typeConfig?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{categories.find((c) => c.value === lesson.category)?.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={priorityConfig?.color}>
                        {priorityConfig?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusConfig?.color}>
                        {statusConfig?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {stageConfig?.label || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lesson.event_date ? new Date(lesson.event_date).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <DocumentUpload
                          entityType="lesson_learned"
                          entityId={lesson.id}
                          entityName={lesson.title}
                          variant="icon"
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(lesson)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(lesson.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
  if (embedded) return content;
  return (
    <AppLayout title="Lessons Learned Register" subtitle="PRINCE2 compliant lessons capture and knowledge management">
      {content}
    </AppLayout>
  );
}
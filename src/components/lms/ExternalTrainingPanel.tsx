import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash2, FileText, Upload, Download, Pencil, CheckCircle2, XCircle, Clock, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const EVENT_TYPES = [
  { value: "course", label: "Course" },
  { value: "conference", label: "Conference" },
  { value: "workshop", label: "Workshop" },
  { value: "webinar", label: "Webinar" },
  { value: "certification", label: "Certification" },
  { value: "seminar", label: "Seminar" },
  { value: "self_study", label: "Self-study" },
  { value: "mentoring", label: "Mentoring/Coaching" },
  { value: "other", label: "Other" },
];

const DELIVERY_MODES = [
  { value: "in_person", label: "In-person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
];

interface ExternalTrainingRecord {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  provider: string | null;
  event_type: string;
  purpose: string | null;
  description: string | null;
  hours: number;
  cpd_credits: number | null;
  category: string | null;
  skills: string[] | null;
  location: string | null;
  delivery_mode: string | null;
  start_date: string | null;
  end_date: string | null;
  cost_amount: number | null;
  status: "submitted" | "approved" | "rejected";
  approval_required: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

interface Attachment {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
}

interface Props {
  /** When true, show records for all users in the org (admin/manager view). */
  managerView?: boolean;
}

export function ExternalTrainingPanel({ managerView = false }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [records, setRecords] = useState<ExternalTrainingRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { first_name?: string; last_name?: string; email?: string }>>({});
  const [requireApproval, setRequireApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalTrainingRecord | null>(null);

  const reload = async () => {
    if (!currentOrganization?.id || !user) return;
    setLoading(true);

    const { data: settings } = await (supabase as any)
      .from("lms_external_training_settings")
      .select("require_approval")
      .eq("organization_id", currentOrganization.id)
      .maybeSingle();
    setRequireApproval(!!settings?.require_approval);

    let q = (supabase as any)
      .from("lms_external_training")
      .select("*")
      .eq("organization_id", currentOrganization.id)
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (!managerView) q = q.eq("user_id", user.id);

    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
    } else {
      const recs = (data ?? []) as ExternalTrainingRecord[];
      setRecords(recs);
      if (managerView && recs.length) {
        const ids = Array.from(new Set(recs.map((r) => r.user_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", ids);
        const map: Record<string, any> = {};
        (profs ?? []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [currentOrganization?.id, user?.id, managerView]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this training record? Attached files will also be removed.")) return;
    const rec = records.find((r) => r.id === id);
    if (rec) {
      const { data: atts } = await (supabase as any)
        .from("lms_external_training_attachments")
        .select("storage_path")
        .eq("external_training_id", id);
      const paths = (atts ?? []).map((a: any) => a.storage_path);
      if (paths.length) await supabase.storage.from("lms-external-training").remove(paths);
    }
    const { error } = await (supabase as any).from("lms_external_training").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    reload();
  };

  const onReview = async (id: string, status: "approved" | "rejected") => {
    const notes = status === "rejected" ? prompt("Reason for rejection (optional):") || null : null;
    const { error } = await (supabase as any)
      .from("lms_external_training")
      .update({
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : "Rejected");
    reload();
  };

  const totalHours = records
    .filter((r) => r.status === "approved" || !r.approval_required)
    .reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const totalCpd = records
    .filter((r) => r.status === "approved" || !r.approval_required)
    .reduce((s, r) => s + (Number(r.cpd_credits) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">External training</h2>
          <p className="text-sm text-muted-foreground">
            {managerView
              ? "Records submitted by members of your organization."
              : "Track conferences, workshops, certifications and other learning outside the LMS."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4 mr-2" />Log training
            </Button>
          </DialogTrigger>
          <ExternalTrainingDialog
            editing={editing}
            requireApproval={requireApproval}
            onSaved={() => { setOpen(false); setEditing(null); reload(); }}
          />
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Records" value={records.length} />
        <Stat label="Approved hours" value={totalHours.toFixed(1)} />
        <Stat label="CPD credits" value={totalCpd.toFixed(1)} />
        <Stat label="Pending" value={records.filter((r) => r.approval_required && r.status === "submitted").length} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : records.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No external training logged yet. Click <strong>Log training</strong> to add your first record.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <ExternalTrainingCard
              key={r.id}
              record={r}
              profile={profiles[r.user_id]}
              managerView={managerView}
              isOwner={r.user_id === user?.id}
              onEdit={() => { setEditing(r); setOpen(true); }}
              onDelete={() => onDelete(r.id)}
              onApprove={() => onReview(r.id, "approved")}
              onReject={() => onReview(r.id, "rejected")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card><CardContent className="py-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </CardContent></Card>
  );
}

function ExternalTrainingCard({
  record, profile, managerView, isOwner, onEdit, onDelete, onApprove, onReject,
}: {
  record: ExternalTrainingRecord;
  profile?: { first_name?: string; last_name?: string; email?: string };
  managerView: boolean;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAtt, setLoadingAtt] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingAtt(true);
      const { data } = await (supabase as any)
        .from("lms_external_training_attachments")
        .select("*")
        .eq("external_training_id", record.id);
      setAttachments((data ?? []) as Attachment[]);
      setLoadingAtt(false);
    })();
  }, [record.id]);

  const downloadAttachment = async (a: Attachment) => {
    const { data, error } = await supabase.storage
      .from("lms-external-training")
      .createSignedUrl(a.storage_path, 60 * 5);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const statusBadge = () => {
    if (!record.approval_required) return null;
    if (record.status === "approved") return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    if (record.status === "rejected") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  const eventLabel = EVENT_TYPES.find((e) => e.value === record.event_type)?.label ?? record.event_type;
  const ownerName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "—"
    : null;

  const canEdit = (isOwner && record.status === "submitted") || managerView;
  const canDelete = canEdit;

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{record.title}</span>
              <Badge variant="outline">{eventLabel}</Badge>
              {statusBadge()}
              {record.category && <Badge variant="secondary">{record.category}</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {record.provider && <span>Provider: {record.provider}</span>}
              {record.start_date && (
                <span>
                  {format(new Date(record.start_date), "PP")}
                  {record.end_date && record.end_date !== record.start_date ? ` – ${format(new Date(record.end_date), "PP")}` : ""}
                </span>
              )}
              {record.location && <span>📍 {record.location}</span>}
              {record.delivery_mode && <span>· {DELIVERY_MODES.find((d) => d.value === record.delivery_mode)?.label}</span>}
              <span>· {Number(record.hours).toFixed(1)} hrs</span>
              {record.cpd_credits != null && <span>· {Number(record.cpd_credits).toFixed(1)} CPD</span>}
              {record.cost_amount != null && <span>· ${Number(record.cost_amount).toFixed(2)}</span>}
              {managerView && ownerName && <span>· by {ownerName}</span>}
            </div>
            {record.purpose && (
              <p className="text-xs mt-2"><span className="font-medium">Purpose:</span> {record.purpose}</p>
            )}
            {record.description && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{record.description}</p>
            )}
            {record.skills && record.skills.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {record.skills.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
              </div>
            )}
            {record.review_notes && (
              <p className="text-xs text-muted-foreground mt-2 italic">Reviewer note: {record.review_notes}</p>
            )}
          </div>

          <div className="flex gap-1 shrink-0">
            {managerView && record.approval_required && record.status === "submitted" && (
              <>
                <Button size="sm" variant="outline" onClick={onApprove}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />Approve
                </Button>
                <Button size="sm" variant="outline" onClick={onReject}>
                  <XCircle className="h-4 w-4 mr-1" />Reject
                </Button>
              </>
            )}
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            )}
            {canDelete && (
              <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        </div>

        {!loadingAtt && attachments.length > 0 && (
          <div className="border-t pt-2 space-y-1">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />Proof ({attachments.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <Button key={a.id} variant="outline" size="sm" onClick={() => downloadAttachment(a)} className="h-7 text-xs">
                  <Download className="h-3 w-3 mr-1" />{a.file_name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExternalTrainingDialog({
  editing, requireApproval, onSaved,
}: {
  editing: ExternalTrainingRecord | null;
  requireApproval: boolean;
  onSaved: () => void;
}) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<ExternalTrainingRecord>>({});
  const [skillsInput, setSkillsInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({ ...editing });
      setSkillsInput((editing.skills ?? []).join(", "));
      (async () => {
        const { data } = await (supabase as any)
          .from("lms_external_training_attachments")
          .select("*")
          .eq("external_training_id", editing.id);
        setExistingAttachments((data ?? []) as Attachment[]);
      })();
    } else {
      setForm({
        title: "",
        event_type: "course",
        hours: 0,
        delivery_mode: "in_person",
      });
      setSkillsInput("");
      setExistingAttachments([]);
    }
    setPendingFiles([]);
  }, [editing]);

  const removeExisting = async (a: Attachment) => {
    if (!confirm(`Remove ${a.file_name}?`)) return;
    await supabase.storage.from("lms-external-training").remove([a.storage_path]);
    await (supabase as any).from("lms_external_training_attachments").delete().eq("id", a.id);
    setExistingAttachments((prev) => prev.filter((x) => x.id !== a.id));
  };

  const handleSave = async () => {
    if (!currentOrganization?.id || !user) return;
    if (!form.title?.trim()) return toast.error("Title is required");
    if (!form.event_type) return toast.error("Event type is required");
    if (form.hours == null || Number(form.hours) < 0) return toast.error("Hours must be 0 or greater");

    setSaving(true);
    try {
      const skills = skillsInput.split(",").map((s) => s.trim()).filter(Boolean);
      const payload: any = {
        title: form.title?.trim(),
        provider: form.provider?.trim() || null,
        event_type: form.event_type,
        purpose: form.purpose?.trim() || null,
        description: form.description?.trim() || null,
        hours: Number(form.hours) || 0,
        cpd_credits: form.cpd_credits != null && form.cpd_credits !== ("" as any) ? Number(form.cpd_credits) : null,
        category: form.category?.trim() || null,
        skills,
        location: form.location?.trim() || null,
        delivery_mode: form.delivery_mode || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        cost_amount: form.cost_amount != null && form.cost_amount !== ("" as any) ? Number(form.cost_amount) : null,
      };

      let recordId = editing?.id;

      if (editing) {
        const { error } = await (supabase as any)
          .from("lms_external_training")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("lms_external_training")
          .insert({
            ...payload,
            organization_id: currentOrganization.id,
            user_id: user.id,
            approval_required: requireApproval,
            status: "submitted",
          })
          .select("id")
          .single();
        if (error) throw error;
        recordId = data.id;
      }

      // Upload pending files
      for (const file of pendingFiles) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${currentOrganization.id}/${user.id}/${recordId}/${crypto.randomUUID()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("lms-external-training")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await (supabase as any)
          .from("lms_external_training_attachments")
          .insert({
            external_training_id: recordId,
            organization_id: currentOrganization.id,
            user_id: user.id,
            file_name: file.name,
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
          });
        if (insErr) throw insErr;
      }

      toast.success(editing ? "Updated" : requireApproval ? "Submitted for approval" : "Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const setDate = (key: "start_date" | "end_date", d?: Date) => {
    setForm((f) => ({ ...f, [key]: d ? format(d, "yyyy-MM-dd") : null }));
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit external training" : "Log external training"}</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label>Title *</Label>
          <Input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. PMI Agile Conference 2026" />
        </div>

        <div>
          <Label>Event type *</Label>
          <Select value={form.event_type} onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Provider / Issuer</Label>
          <Input value={form.provider ?? ""} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} placeholder="e.g. PMI, Coursera, Internal" />
        </div>

        <div>
          <Label>Hours *</Label>
          <Input type="number" min="0" step="0.25" value={form.hours ?? 0} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value as any }))} />
        </div>

        <div>
          <Label>CPD / CEU credits</Label>
          <Input type="number" min="0" step="0.25" value={form.cpd_credits ?? ""} onChange={(e) => setForm((f) => ({ ...f, cpd_credits: e.target.value as any }))} placeholder="Optional" />
        </div>

        <div>
          <Label>Start date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start font-normal", !form.start_date && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {form.start_date ? format(new Date(form.start_date), "PP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={form.start_date ? new Date(form.start_date) : undefined} onSelect={(d) => setDate("start_date", d)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label>End date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start font-normal", !form.end_date && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {form.end_date ? format(new Date(form.end_date), "PP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={form.end_date ? new Date(form.end_date) : undefined} onSelect={(d) => setDate("end_date", d)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label>Delivery mode</Label>
          <Select value={form.delivery_mode ?? "in_person"} onValueChange={(v) => setForm((f) => ({ ...f, delivery_mode: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DELIVERY_MODES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Location</Label>
          <Input value={form.location ?? ""} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. London, UK or Online" />
        </div>

        <div>
          <Label>Category</Label>
          <Input value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Leadership, Technical" />
        </div>

        <div>
          <Label>Cost (USD)</Label>
          <Input type="number" min="0" step="0.01" value={form.cost_amount ?? ""} onChange={(e) => setForm((f) => ({ ...f, cost_amount: e.target.value as any }))} placeholder="Optional" />
        </div>

        <div className="sm:col-span-2">
          <Label>Skills (comma separated)</Label>
          <Input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="e.g. PRINCE2, Risk Management, Scrum" />
        </div>

        <div className="sm:col-span-2">
          <Label>Purpose / Learning objective</Label>
          <Textarea rows={2} value={form.purpose ?? ""} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} placeholder="Why did you take this training? What was the goal?" />
        </div>

        <div className="sm:col-span-2">
          <Label>Description / Notes</Label>
          <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Key takeaways, content covered, etc." />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label>Proof / Supporting documents</Label>
          {existingAttachments.length > 0 && (
            <div className="space-y-1">
              {existingAttachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                  <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{a.file_name}</span>
                  <Button size="sm" variant="ghost" className="h-6" onClick={() => removeExisting(a)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {pendingFiles.length > 0 && (
            <div className="space-y-1">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs border rounded px-2 py-1 bg-muted/30">
                  <span className="flex items-center gap-1"><Upload className="h-3 w-3" />{f.name} <span className="text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span></span>
                  <Button size="sm" variant="ghost" className="h-6" onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              const oversized = files.find((f) => f.size > 10 * 1024 * 1024);
              if (oversized) return toast.error(`${oversized.name} exceeds 10MB`);
              setPendingFiles((p) => [...p, ...files]);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">PDFs, images, Office docs. Up to 10MB each.</p>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : editing ? "Save" : requireApproval ? "Submit for approval" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { QuickActionTabs } from "@/components/QuickActionTabs";
import { SignaturePad, SignaturePadHandle } from "@/components/SignaturePad";
import {
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  Mail,
  Download,
  ListChecks,
  Clock,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import {
  addDays,
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  formatISO,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { buildTimesheetPdf, type TimesheetEntryRow } from "@/lib/timesheetPdf";

type Status = "draft" | "submitted" | "approved" | "rejected";

interface Timesheet {
  id: string;
  organization_id: string;
  user_id: string;
  reference_number: string | null;
  period_start: string;
  period_end: string;
  status: Status;
  notes: string | null;
  approver_id: string | null;
  submitted_at: string | null;
  submitter_signature_name: string | null;
  submitter_signature_image: string | null;
  decided_at: string | null;
  approver_signature_name: string | null;
  approver_signature_image: string | null;
  decision_notes: string | null;
}

interface Entry {
  id: string;
  timesheet_id: string;
  programme_id: string | null;
  project_id: string | null;
  product_id: string | null;
  task_id: string | null;
  ticket_id: string | null;
  description: string | null;
  hours_mon: number;
  hours_tue: number;
  hours_wed: number;
  hours_thu: number;
  hours_fri: number;
  hours_sat: number;
  hours_sun: number;
  sort_order: number;
}

interface NamedRow {
  id: string;
  name: string;
}
interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

const DAY_KEYS: Array<keyof Pick<
  Entry,
  "hours_mon" | "hours_tue" | "hours_wed" | "hours_thu" | "hours_fri" | "hours_sat" | "hours_sun"
>> = [
  "hours_mon",
  "hours_tue",
  "hours_wed",
  "hours_thu",
  "hours_fri",
  "hours_sat",
  "hours_sun",
];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function entryTotal(e: Entry): number {
  return DAY_KEYS.reduce((s, k) => s + (Number(e[k]) || 0), 0);
}

function statusBadge(status: Status) {
  const map: Record<Status, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    submitted: { label: "Submitted", className: "bg-primary/10 text-primary" },
    approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-600" },
    rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
  };
  const m = map[status];
  return <Badge className={m.className}>{m.label}</Badge>;
}

export default function Timesheets() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState("mine");
  const [loading, setLoading] = useState(false);

  const [mySheets, setMySheets] = useState<Timesheet[]>([]);
  const [approvalSheets, setApprovalSheets] = useState<Timesheet[]>([]);

  // Lookup data
  const [programmes, setProgrammes] = useState<NamedRow[]>([]);
  const [projects, setProjects] = useState<NamedRow[]>([]);
  const [products, setProducts] = useState<NamedRow[]>([]);
  const [tasksList, setTasksList] = useState<NamedRow[]>([]);
  const [tickets, setTickets] = useState<NamedRow[]>([]);
  const [orgUsers, setOrgUsers] = useState<ProfileRow[]>([]);

  // Editor state
  const [selectedSheet, setSelectedSheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);

  // Submit dialog
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitName, setSubmitName] = useState("");
  const [submitApproverId, setSubmitApproverId] = useState<string>("");
  const submitSigRef = useRef<SignaturePadHandle>(null);

  // Decision dialog (approver)
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<"approve" | "reject">("approve");
  const [decisionName, setDecisionName] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const decisionSigRef = useRef<SignaturePadHandle>(null);

  // Email dialog
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [emailSheetId, setEmailSheetId] = useState<string | null>(null);

  const orgUsersById = useMemo(() => {
    const m = new Map<string, ProfileRow>();
    orgUsers.forEach((u) => m.set(u.user_id, u));
    return m;
  }, [orgUsers]);

  const fetchAll = async () => {
    if (!user || !currentOrganization) return;
    setLoading(true);
    try {
      const [mineRes, approvalsRes, progRes, projRes, prodRes, taskRes, ticketRes, profRes, accessRes] =
        await Promise.all([
          supabase
            .from("timesheets")
            .select("*")
            .eq("user_id", user.id)
            .eq("organization_id", currentOrganization.id)
            .order("period_start", { ascending: false }),
          supabase
            .from("timesheets")
            .select("*")
            .eq("approver_id", user.id)
            .eq("organization_id", currentOrganization.id)
            .neq("status", "draft")
            .order("submitted_at", { ascending: false }),
          supabase
            .from("programmes")
            .select("id, name")
            .eq("organization_id", currentOrganization.id)
            .eq("timesheets_enabled", true)
            .order("name"),
          supabase
            .from("projects")
            .select("id, name")
            .eq("organization_id", currentOrganization.id)
            .eq("timesheets_enabled", true)
            .order("name"),
          supabase
            .from("products")
            .select("id, name")
            .eq("organization_id", currentOrganization.id)
            .eq("timesheets_enabled", true)
            .order("name"),
          supabase
            .from("tasks")
            .select("id, name")
            .eq("organization_id", currentOrganization.id)
            .order("name"),
          supabase
            .from("helpdesk_tickets")
            .select("id, subject, reference_number")
            .eq("organization_id", currentOrganization.id)
            .not("status", "in", "(closed,cancelled)")
            .order("created_at", { ascending: false })
            .limit(500),
          supabase.from("profiles").select("user_id, full_name, email"),
          supabase
            .from("user_organization_access")
            .select("user_id")
            .eq("organization_id", currentOrganization.id),
        ]);

      if (mineRes.error) throw mineRes.error;
      if (approvalsRes.error) throw approvalsRes.error;

      setMySheets((mineRes.data || []) as Timesheet[]);
      setApprovalSheets((approvalsRes.data || []) as Timesheet[]);
      setProgrammes((progRes.data || []) as NamedRow[]);
      setProjects((projRes.data || []) as NamedRow[]);
      setProducts((prodRes.data || []) as NamedRow[]);
      setTasksList(
        ((taskRes.data || []) as Array<{ id: string; name: string }>).map((t) => ({
          id: t.id,
          name: t.name,
        })),
      );
      setTickets(
        ((ticketRes.data || []) as Array<{ id: string; subject: string; reference_number: string | null }>).map((t) => ({
          id: t.id,
          name: t.reference_number ? `${t.reference_number} — ${t.subject}` : t.subject,
        })),
      );

      const orgUserIds = new Set(
        ((accessRes.data || []) as Array<{ user_id: string }>).map((r) => r.user_id),
      );
      const profiles = ((profRes.data || []) as ProfileRow[]).filter((p) =>
        orgUserIds.has(p.user_id),
      );
      setOrgUsers(profiles);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentOrganization?.id]);

  // If navigated here with ?ticketId=, auto-create/open this week and add the ticket entry.
  useEffect(() => {
    const tid = searchParams.get("ticketId");
    if (!tid) return;
    if (!user || !currentOrganization) return;
    // Wait until lookups have loaded so logTimeForTicket sees mySheets.
    if (loading) return;
    logTimeForTicket(tid).finally(() => {
      const next = new URLSearchParams(searchParams);
      next.delete("ticketId");
      setSearchParams(next, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id, currentOrganization?.id, loading]);

  const loadEntries = async (sheetId: string) => {
    const { data, error } = await supabase
      .from("timesheet_entries")
      .select("*")
      .eq("timesheet_id", sheetId)
      .order("sort_order");
    if (error) {
      toast.error("Failed to load entries");
      return;
    }
    setEntries((data || []) as Entry[]);
  };

  const openEditor = async (sheet: Timesheet) => {
    setSelectedSheet(sheet);
    await loadEntries(sheet.id);
    setEditorOpen(true);
  };

  const createNewWeek = async () => {
    if (!user || !currentOrganization) return;
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sunday = endOfWeek(new Date(), { weekStartsOn: 1 });
    const period_start = format(monday, "yyyy-MM-dd");
    const period_end = format(sunday, "yyyy-MM-dd");

    // If one already exists, open it
    const existing = mySheets.find((s) => s.period_start === period_start);
    if (existing) {
      openEditor(existing);
      return;
    }

    const { data, error } = await supabase
      .from("timesheets")
      .insert({
        organization_id: currentOrganization.id,
        user_id: user.id,
        period_start,
        period_end,
        status: "draft",
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setMySheets((s) => [data as Timesheet, ...s]);
    openEditor(data as Timesheet);
  };

  const addEntry = async () => {
    if (!selectedSheet) return;
    const { data, error } = await supabase
      .from("timesheet_entries")
      .insert({
        timesheet_id: selectedSheet.id,
        sort_order: entries.length,
        // default link must satisfy CHECK — use first available project else programme/product/task
        project_id: projects[0]?.id ?? null,
        programme_id: !projects[0] ? programmes[0]?.id ?? null : null,
        product_id: !projects[0] && !programmes[0] ? products[0]?.id ?? null : null,
        task_id:
          !projects[0] && !programmes[0] && !products[0] ? tasksList[0]?.id ?? null : null,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setEntries((es) => [...es, data as Entry]);
  };

  // Open / create the current week's draft and append an entry pre-linked to a ticket.
  const logTimeForTicket = async (ticketId: string) => {
    if (!user || !currentOrganization) return;
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sunday = endOfWeek(new Date(), { weekStartsOn: 1 });
    const period_start = format(monday, "yyyy-MM-dd");
    const period_end = format(sunday, "yyyy-MM-dd");

    let sheet = mySheets.find((s) => s.period_start === period_start) ?? null;
    if (!sheet) {
      const { data, error } = await supabase
        .from("timesheets")
        .insert({
          organization_id: currentOrganization.id,
          user_id: user.id,
          period_start,
          period_end,
          status: "draft",
        })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      sheet = data as Timesheet;
      setMySheets((s) => [sheet as Timesheet, ...s]);
    }
    if (sheet.status !== "draft") {
      toast.error("This week's timesheet is no longer a draft");
      await openEditor(sheet);
      return;
    }

    // Load existing entries to compute sort order, then add a ticket-linked entry.
    const { data: existing } = await supabase
      .from("timesheet_entries")
      .select("id")
      .eq("timesheet_id", sheet.id);
    const sortOrder = (existing?.length ?? 0);

    const { data: newEntry, error: entryErr } = await supabase
      .from("timesheet_entries")
      .insert({
        timesheet_id: sheet.id,
        sort_order: sortOrder,
        ticket_id: ticketId,
      })
      .select()
      .single();
    if (entryErr) {
      toast.error(entryErr.message);
      return;
    }

    setSelectedSheet(sheet);
    await loadEntries(sheet.id);
    setEditorOpen(true);
    toast.success("Ticket added to this week's timesheet");
  };

  const updateEntry = async (id: string, patch: Partial<Entry>) => {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await supabase.from("timesheet_entries").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const removeEntry = async (id: string) => {
    setEntries((es) => es.filter((e) => e.id !== id));
    const { error } = await supabase.from("timesheet_entries").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteSheet = async (sheet: Timesheet) => {
    if (sheet.status !== "draft") {
      toast.error("Only draft timesheets can be deleted");
      return;
    }
    if (!window.confirm("Delete this draft timesheet and all its entries? This cannot be undone.")) {
      return;
    }
    // Remove entries first (FK), then the sheet
    const { error: entriesErr } = await supabase
      .from("timesheet_entries")
      .delete()
      .eq("timesheet_id", sheet.id);
    if (entriesErr) {
      toast.error(entriesErr.message);
      return;
    }
    const { error } = await supabase.from("timesheets").delete().eq("id", sheet.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMySheets((s) => s.filter((x) => x.id !== sheet.id));
    if (selectedSheet?.id === sheet.id) {
      setEditorOpen(false);
      setSelectedSheet(null);
    }
    toast.success("Draft timesheet deleted");
  };

  const updateNotes = async (notes: string) => {
    if (!selectedSheet) return;
    setSelectedSheet({ ...selectedSheet, notes });
    await supabase.from("timesheets").update({ notes }).eq("id", selectedSheet.id);
  };

  const openSubmit = () => {
    if (!selectedSheet) return;
    if (entries.length === 0) {
      toast.error("Add at least one entry first");
      return;
    }
    setSubmitName("");
    setSubmitApproverId("");
    setSubmitOpen(true);
  };

  const doSubmit = async () => {
    if (!selectedSheet) return;
    if (!submitName.trim()) {
      toast.error("Please type your name to sign");
      return;
    }
    if (!submitApproverId) {
      toast.error("Please choose an approver");
      return;
    }
    const drawn = submitSigRef.current?.getDataUrl() ?? null;
    const { data, error } = await supabase
      .from("timesheets")
      .update({
        status: "submitted",
        approver_id: submitApproverId,
        submitted_at: new Date().toISOString(),
        submitter_signature_name: submitName.trim(),
        submitter_signature_image: drawn,
      })
      .eq("id", selectedSheet.id)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelectedSheet(data as Timesheet);
    setMySheets((s) => s.map((x) => (x.id === data.id ? (data as Timesheet) : x)));
    setSubmitOpen(false);
    toast.success("Timesheet submitted for approval");
  };

  const openDecision = (action: "approve" | "reject") => {
    setDecisionAction(action);
    setDecisionName("");
    setDecisionNotes("");
    setDecisionOpen(true);
  };

  const doDecision = async () => {
    if (!selectedSheet) return;
    if (!decisionName.trim()) {
      toast.error("Please type your name to sign");
      return;
    }
    const drawn = decisionSigRef.current?.getDataUrl() ?? null;
    const { data, error } = await supabase
      .from("timesheets")
      .update({
        status: decisionAction === "approve" ? "approved" : "rejected",
        decided_at: new Date().toISOString(),
        approver_signature_name: decisionName.trim(),
        approver_signature_image: drawn,
        decision_notes: decisionNotes.trim() || null,
      })
      .eq("id", selectedSheet.id)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelectedSheet(data as Timesheet);
    setApprovalSheets((s) => s.map((x) => (x.id === data.id ? (data as Timesheet) : x)));
    setDecisionOpen(false);
    toast.success(`Timesheet ${decisionAction === "approve" ? "approved" : "rejected"}`);
  };

  // ---------- PDF / Email ----------

  const buildPdfFor = async (sheet: Timesheet) => {
    const { data: ents } = await supabase
      .from("timesheet_entries")
      .select("*")
      .eq("timesheet_id", sheet.id)
      .order("sort_order");

    const rows = ((ents || []) as Entry[]).map<TimesheetEntryRow>((e) => {
      const labelParts: string[] = [];
      if (e.programme_id)
        labelParts.push(`Program: ${programmes.find((p) => p.id === e.programme_id)?.name ?? e.programme_id}`);
      if (e.project_id)
        labelParts.push(`Project: ${projects.find((p) => p.id === e.project_id)?.name ?? e.project_id}`);
      if (e.product_id)
        labelParts.push(`Product: ${products.find((p) => p.id === e.product_id)?.name ?? e.product_id}`);
      if (e.task_id)
        labelParts.push(`Task: ${tasksList.find((t) => t.id === e.task_id)?.name ?? e.task_id}`);
      if (e.ticket_id)
        labelParts.push(`Ticket: ${tickets.find((t) => t.id === e.ticket_id)?.name ?? e.ticket_id}`);
      return {
        label: labelParts.join(" · ") || "—",
        description: e.description,
        hours_mon: Number(e.hours_mon),
        hours_tue: Number(e.hours_tue),
        hours_wed: Number(e.hours_wed),
        hours_thu: Number(e.hours_thu),
        hours_fri: Number(e.hours_fri),
        hours_sat: Number(e.hours_sat),
        hours_sun: Number(e.hours_sun),
      };
    });

    const owner = orgUsersById.get(sheet.user_id);
    const approver = sheet.approver_id ? orgUsersById.get(sheet.approver_id) : null;

    return buildTimesheetPdf({
      reference: sheet.reference_number,
      organizationName: currentOrganization?.name ?? null,
      userName: owner?.full_name || owner?.email || sheet.user_id,
      approverName: approver?.full_name || approver?.email || "—",
      periodStart: sheet.period_start,
      periodEnd: sheet.period_end,
      status: sheet.status,
      notes: sheet.notes,
      entries: rows,
      submitter: {
        name: sheet.submitter_signature_name,
        image: sheet.submitter_signature_image,
        at: sheet.submitted_at,
      },
      approver: {
        name: sheet.approver_signature_name,
        image: sheet.approver_signature_image,
        at: sheet.decided_at,
      },
    });
  };

  const downloadPdf = async (sheet: Timesheet) => {
    const doc = await buildPdfFor(sheet);
    doc.save(`Timesheet_${sheet.reference_number || sheet.id}.pdf`);
  };

  const openEmail = (sheet: Timesheet) => {
    setEmailSheetId(sheet.id);
    const approver = sheet.approver_id ? orgUsersById.get(sheet.approver_id) : null;
    setEmailTo(approver?.email || "");
    setEmailMsg("");
    setEmailOpen(true);
  };

  const sendEmail = async () => {
    if (!emailSheetId) return;
    const sheet =
      mySheets.find((s) => s.id === emailSheetId) ||
      approvalSheets.find((s) => s.id === emailSheetId);
    if (!sheet) return;

    const recipients = emailTo
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));
    if (recipients.length === 0) {
      toast.error("Add at least one recipient email");
      return;
    }

    const doc = await buildPdfFor(sheet);
    // jsPDF datauri returns "data:application/pdf;base64,XXXX"
    const dataUri = doc.output("datauristring");
    const base64 = dataUri.split(",")[1] ?? "";

    const { error } = await supabase.functions.invoke("email-timesheet", {
      body: {
        to: recipients,
        subject: `Timesheet ${sheet.reference_number || ""} — ${format(parseISO(sheet.period_start), "PPP")}`,
        message: emailMsg,
        pdf_base64: base64,
        filename: `Timesheet_${sheet.reference_number || sheet.id}.pdf`,
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Email sent");
    setEmailOpen(false);
  };

  // ---------- Render ----------

  const canEdit =
    selectedSheet &&
    selectedSheet.user_id === user?.id &&
    (selectedSheet.status === "draft" || selectedSheet.status === "rejected");
  const canApprove =
    selectedSheet &&
    selectedSheet.approver_id === user?.id &&
    selectedSheet.status === "submitted";

  const weeklyTotal = entries.reduce((s, e) => s + entryTotal(e), 0);

  return (
    <AppLayout
      title="Timesheets"
      subtitle="Log time against programs, projects, products, and tasks"
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <QuickActionTabs
            items={[
              { value: "mine", label: "My Timesheets", icon: Clock, count: mySheets.length },
              {
                value: "approvals",
                label: "Approvals",
                icon: ShieldCheck,
                count: approvalSheets.filter((s) => s.status === "submitted").length,
              },
            ]}
            className="flex-1 grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2"
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={createNewWeek} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New / Open Current Week
            </Button>
          </div>
        </div>

        <TabsContent value="mine" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Timesheets</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approver</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mySheets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No timesheets yet. Click "New / Open Current Week" to start.
                      </TableCell>
                    </TableRow>
                  )}
                  {mySheets.map((s) => {
                    const approver = s.approver_id ? orgUsersById.get(s.approver_id) : null;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">
                          {s.reference_number || "—"}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(s.period_start), "PP")} –{" "}
                          {format(parseISO(s.period_end), "PP")}
                        </TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell className="text-sm">
                          {approver?.full_name || approver?.email || "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditor(s)}>
                            Open
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => downloadPdf(s)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEmail(s)}>
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                          {s.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteSheet(s)}
                              title="Delete draft"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Awaiting Your Decision</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Submitter</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvalSheets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No timesheets pending your approval.
                      </TableCell>
                    </TableRow>
                  )}
                  {approvalSheets.map((s) => {
                    const owner = orgUsersById.get(s.user_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">
                          {s.reference_number || "—"}
                        </TableCell>
                        <TableCell>{owner?.full_name || owner?.email || s.user_id}</TableCell>
                        <TableCell>
                          {format(parseISO(s.period_start), "PP")} –{" "}
                          {format(parseISO(s.period_end), "PP")}
                        </TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditor(s)}>
                            Review
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => downloadPdf(s)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Editor dialog ===== */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>
                Timesheet{" "}
                <span className="font-mono text-sm text-muted-foreground">
                  {selectedSheet?.reference_number || ""}
                </span>
              </span>
              {selectedSheet && statusBadge(selectedSheet.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedSheet &&
                `${format(parseISO(selectedSheet.period_start), "PPP")} – ${format(
                  parseISO(selectedSheet.period_end),
                  "PPP",
                )}`}
            </DialogDescription>
          </DialogHeader>

          {selectedSheet && (
            <div className="space-y-4">
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[260px]">Item</TableHead>
                      <TableHead className="min-w-[180px]">Description</TableHead>
                      {DAY_LABELS.map((d, i) => (
                        <TableHead key={d} className="text-center w-16">
                          <div>{d}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {selectedSheet
                              ? format(addDays(parseISO(selectedSheet.period_start), i), "d MMM")
                              : ""}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center w-16">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                          No entries — add one below.
                        </TableCell>
                      </TableRow>
                    )}
                    {entries.map((e) => {
                      const linkType = e.programme_id
                        ? "programme"
                        : e.project_id
                          ? "project"
                          : e.product_id
                            ? "product"
                            : e.ticket_id
                              ? "ticket"
                              : "task";
                      const linkValue =
                        e.programme_id || e.project_id || e.product_id || e.task_id || e.ticket_id || "";
                      return (
                        <TableRow key={e.id}>
                          <TableCell>
                            <div className="flex gap-1">
                              <Select
                                value={linkType}
                                onValueChange={(v) => {
                                  // Reset link when switching type
                                  const patch: Partial<Entry> = {
                                    programme_id: null,
                                    project_id: null,
                                    product_id: null,
                                    task_id: null,
                                    ticket_id: null,
                                  };
                                  const first =
                                    v === "programme"
                                      ? programmes[0]?.id
                                      : v === "project"
                                        ? projects[0]?.id
                                        : v === "product"
                                          ? products[0]?.id
                                          : v === "ticket"
                                            ? tickets[0]?.id
                                            : tasksList[0]?.id;
                                  if (v === "programme") patch.programme_id = first ?? null;
                                  if (v === "project") patch.project_id = first ?? null;
                                  if (v === "product") patch.product_id = first ?? null;
                                  if (v === "task") patch.task_id = first ?? null;
                                  if (v === "ticket") patch.ticket_id = first ?? null;
                                  updateEntry(e.id, patch);
                                }}
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="w-[110px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="programme">Program</SelectItem>
                                  <SelectItem value="project">Project</SelectItem>
                                  <SelectItem value="product">Product</SelectItem>
                                  <SelectItem value="task">Task</SelectItem>
                                  <SelectItem value="ticket">Ticket</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={linkValue}
                                onValueChange={(v) => {
                                  const patch: Partial<Entry> = {
                                    programme_id: null,
                                    project_id: null,
                                    product_id: null,
                                    task_id: null,
                                    ticket_id: null,
                                  };
                                  if (linkType === "programme") patch.programme_id = v;
                                  if (linkType === "project") patch.project_id = v;
                                  if (linkType === "product") patch.product_id = v;
                                  if (linkType === "task") patch.task_id = v;
                                  if (linkType === "ticket") patch.ticket_id = v;
                                  updateEntry(e.id, patch);
                                }}
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="flex-1 min-w-[140px]">
                                  <SelectValue placeholder="Select…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(linkType === "programme"
                                    ? programmes
                                    : linkType === "project"
                                      ? projects
                                      : linkType === "product"
                                        ? products
                                        : linkType === "ticket"
                                          ? tickets
                                          : tasksList
                                  ).map((row) => (
                                    <SelectItem key={row.id} value={row.id}>
                                      {row.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={e.description ?? ""}
                              onChange={(ev) => updateEntry(e.id, { description: ev.target.value })}
                              disabled={!canEdit}
                              placeholder="Optional notes"
                            />
                          </TableCell>
                          {DAY_KEYS.map((key) => (
                            <TableCell key={key} className="p-1">
                              <Input
                                type="number"
                                min={0}
                                step={0.25}
                                value={Number(e[key]) || ""}
                                onChange={(ev) =>
                                  updateEntry(e.id, {
                                    [key]: parseFloat(ev.target.value) || 0,
                                  } as Partial<Entry>)
                                }
                                disabled={!canEdit}
                                className="w-16 h-9 text-center"
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-medium">
                            {entryTotal(e).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeEntry(e.id)}
                              disabled={!canEdit}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <Button size="sm" variant="outline" onClick={addEntry} disabled={!canEdit}>
                  <Plus className="h-3.5 w-3.5" /> Add line
                </Button>
                <div className="text-sm">
                  Weekly total:{" "}
                  <span className="font-bold text-base">{weeklyTotal.toFixed(2)} h</span>
                </div>
              </div>

              <div>
                <Label htmlFor="ts-notes">Notes</Label>
                <Textarea
                  id="ts-notes"
                  value={selectedSheet.notes ?? ""}
                  onChange={(e) => updateNotes(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Optional notes for the approver…"
                />
              </div>

              {/* Signatures display */}
              {(selectedSheet.submitter_signature_name ||
                selectedSheet.approver_signature_name) && (
                <Card>
                  <CardContent className="grid gap-4 md:grid-cols-2 pt-4">
                    {selectedSheet.submitter_signature_name && (
                      <div>
                        <p className="text-xs uppercase text-muted-foreground mb-1">
                          Submitted by
                        </p>
                        {selectedSheet.submitter_signature_image && (
                          <img
                            src={selectedSheet.submitter_signature_image}
                            alt="Submitter signature"
                            className="h-16 border rounded bg-background"
                          />
                        )}
                        <p className="font-medium mt-1">
                          {selectedSheet.submitter_signature_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedSheet.submitted_at
                            ? format(parseISO(selectedSheet.submitted_at), "PPP p")
                            : ""}
                        </p>
                      </div>
                    )}
                    {selectedSheet.approver_signature_name && (
                      <div>
                        <p className="text-xs uppercase text-muted-foreground mb-1">
                          {selectedSheet.status === "rejected" ? "Rejected by" : "Approved by"}
                        </p>
                        {selectedSheet.approver_signature_image && (
                          <img
                            src={selectedSheet.approver_signature_image}
                            alt="Approver signature"
                            className="h-16 border rounded bg-background"
                          />
                        )}
                        <p className="font-medium mt-1">
                          {selectedSheet.approver_signature_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedSheet.decided_at
                            ? format(parseISO(selectedSheet.decided_at), "PPP p")
                            : ""}
                        </p>
                        {selectedSheet.decision_notes && (
                          <p className="text-sm mt-2">{selectedSheet.decision_notes}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            {selectedSheet && (
              <>
                <Button variant="outline" onClick={() => downloadPdf(selectedSheet)}>
                  <Download className="h-4 w-4" /> PDF
                </Button>
                <Button variant="outline" onClick={() => openEmail(selectedSheet)}>
                  <Mail className="h-4 w-4" /> Email
                </Button>
                {selectedSheet.status === "draft" && (
                  <Button variant="destructive" onClick={() => deleteSheet(selectedSheet)}>
                    <Trash2 className="h-4 w-4" /> Delete Draft
                  </Button>
                )}
                {canEdit && (
                  <Button onClick={openSubmit}>
                    <Send className="h-4 w-4" /> Submit for Approval
                  </Button>
                )}
                {canApprove && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => openDecision("reject")}
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                    <Button onClick={() => openDecision("approve")}>
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                  </>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Submit dialog ===== */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit timesheet for approval</DialogTitle>
            <DialogDescription>
              Choose your approver and sign to attest the hours you've recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Approver</Label>
              <Select value={submitApproverId} onValueChange={setSubmitApproverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an approver…" />
                </SelectTrigger>
                <SelectContent>
                  {orgUsers
                    .filter((u) => u.user_id !== user?.id)
                    .map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name || u.email || u.user_id}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="submit-name">Type your full name to sign *</Label>
              <Input
                id="submit-name"
                value={submitName}
                onChange={(e) => setSubmitName(e.target.value)}
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div>
              <Label>Drawn signature (optional)</Label>
              <SignaturePad ref={submitSigRef} />
            </div>
            <p className="text-xs text-muted-foreground">
              By signing you confirm the hours recorded are accurate. A timestamp will be
              recorded.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doSubmit}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Decision dialog ===== */}
      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionAction === "approve" ? "Approve timesheet" : "Reject timesheet"}
            </DialogTitle>
            <DialogDescription>
              Sign to record your decision. A timestamp will be saved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dec-name">Type your full name to sign *</Label>
              <Input
                id="dec-name"
                value={decisionName}
                onChange={(e) => setDecisionName(e.target.value)}
              />
            </div>
            <div>
              <Label>Drawn signature (optional)</Label>
              <SignaturePad ref={decisionSigRef} />
            </div>
            <div>
              <Label htmlFor="dec-notes">Notes (optional)</Label>
              <Textarea
                id="dec-notes"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Reason or comments…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={doDecision}
              variant={decisionAction === "approve" ? "default" : "destructive"}
            >
              {decisionAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Email dialog ===== */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email signed timesheet</DialogTitle>
            <DialogDescription>
              The PDF (with signatures, if present) will be attached.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="em-to">Recipient(s) — comma-separated</Label>
              <Input
                id="em-to"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="approver@example.com, finance@example.com"
              />
            </div>
            <div>
              <Label htmlFor="em-msg">Message (optional)</Label>
              <Textarea
                id="em-msg"
                value={emailMsg}
                onChange={(e) => setEmailMsg(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendEmail}>
              <Mail className="h-4 w-4" /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

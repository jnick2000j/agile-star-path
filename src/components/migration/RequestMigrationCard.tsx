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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeftRight, Loader2, Plus, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { format } from "date-fns";

const SOURCE_SYSTEMS = [
  { value: "jira", label: "Jira (Software / Cloud)" },
  { value: "jsm", label: "Jira Service Management" },
  { value: "confluence", label: "Confluence" },
  { value: "csv", label: "CSV / Spreadsheet upload" },
  { value: "azure_devops", label: "Azure DevOps" },
  { value: "monday", label: "Monday.com" },
  { value: "asana", label: "Asana" },
  { value: "other", label: "Other" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  in_progress: "bg-info/10 text-info border-info/20",
  completed: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

interface MigrationRequestRow {
  id: string;
  source_system: string;
  source_details: string | null;
  scope: string | null;
  expected_record_count: number | null;
  status: string;
  notes: string | null;
  provisioning_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
}

export function RequestMigrationCard() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [requests, setRequests] = useState<MigrationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [sourceSystem, setSourceSystem] = useState<string>("jira");
  const [sourceDetails, setSourceDetails] = useState("");
  const [scope, setScope] = useState("");
  const [expected, setExpected] = useState<string>("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  const fetchRequests = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("migration_requests")
      .select("*")
      .eq("organization_id", currentOrganization.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("migration requests load failed", error);
      toast.error("Failed to load migration requests");
    } else {
      setRequests((data ?? []) as MigrationRequestRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (open && user?.email && !contactEmail) setContactEmail(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => {
    setSourceSystem("jira");
    setSourceDetails("");
    setScope("");
    setExpected("");
    setNotes("");
  };

  const submit = async () => {
    if (!user || !currentOrganization?.id) return;
    if (!sourceSystem) {
      toast.error("Pick a source system");
      return;
    }
    if (!scope.trim()) {
      toast.error("Describe what should be migrated");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        organization_id: currentOrganization.id,
        requested_by: user.id,
        source_system: sourceSystem,
        source_details: sourceDetails.trim() || null,
        scope: scope.trim(),
        expected_record_count: expected.trim() ? Number(expected) : null,
        contact_email: contactEmail.trim() || user.email || null,
        notes: notes.trim() || null,
        status: "pending",
      };
      const { error } = await (supabase as any).from("migration_requests").insert(payload);
      if (error) throw error;
      toast.success("Migration request submitted — the platform team will be in touch.");
      setOpen(false);
      reset();
      fetchRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const sourceLabel = (v: string) => SOURCE_SYSTEMS.find((s) => s.value === v)?.label ?? v;

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Request a Data Migration</h2>
              {pendingCount > 0 && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                  {pendingCount} pending
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Ask the platform team to import data from another tool (Jira, JSM, CSV, etc.) into this organization.
              You'll be contacted once the request is reviewed.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" /> New request
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground border rounded-md">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-60" />
            No migration requests yet. Submit one to get help importing your data.
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="border rounded-md p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{sourceLabel(r.source_system)}</span>
                    <Badge variant="outline" className={`capitalize ${STATUS_BADGE[r.status] ?? ""}`}>
                      {r.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {r.scope && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.scope}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted {format(new Date(r.created_at), "MMM d, yyyy")}
                    {r.completed_at && ` · Completed ${format(new Date(r.completed_at), "MMM d, yyyy")}`}
                  </p>
                  {r.provisioning_notes && (
                    <p className="text-xs bg-muted/50 rounded p-2 mt-2">
                      <span className="font-medium">Platform notes: </span>
                      {r.provisioning_notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request a data migration</DialogTitle>
            <DialogDescription>
              Tell the platform team what you'd like imported. They'll review and follow up before running anything.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Source system *</Label>
              <Select value={sourceSystem} onValueChange={setSourceSystem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_SYSTEMS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Source details</Label>
              <Input
                value={sourceDetails}
                onChange={(e) => setSourceDetails(e.target.value)}
                placeholder="e.g. https://acme.atlassian.net — projects ABC, DEF"
              />
            </div>

            <div>
              <Label>What should be migrated? *</Label>
              <Textarea
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                rows={3}
                placeholder="e.g. All open issues from project ABC plus their comments and attachments. Map epics → programmes."
                maxLength={2000}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expected record count</Label>
                <Input
                  type="number"
                  min={0}
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  placeholder="e.g. 1500"
                />
              </div>
              <div>
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <Label>Additional notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Anything the platform team should know — deadlines, special handling, etc."
                maxLength={2000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

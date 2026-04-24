import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bell, MessageSquareWarning, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const NOTIFY_FIELDS: Array<{ key: string; label: string; help: string }> = [
  { key: "notify_on_status_change", label: "Status changes", help: "Submitted, approved, scheduled, implemented, etc." },
  { key: "notify_on_type_change", label: "Change type changes", help: "Standard / normal / emergency / operational." },
  { key: "notify_on_urgency_change", label: "Urgency changes", help: "Low / medium / high / critical." },
  { key: "notify_on_impact_change", label: "Impact changes", help: "Business / service impact reassessed." },
  { key: "notify_on_owner_change", label: "Owner reassignments", help: "Change request handed to a new owner." },
  { key: "notify_on_progress_note", label: "Progress updates", help: "Implementer progress posts." },
  { key: "notify_on_test_result", label: "Test results", help: "Verification or rollback test outcomes." },
  { key: "notify_on_implementation_note", label: "Implementation notes", help: "Notes captured during execution." },
  { key: "notify_on_comment", label: "General comments", help: "Free-form discussion comments." },
  { key: "notify_on_approval_decision", label: "Approval decisions", help: "Approve / reject by an approver." },
];

const REQUIRE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "require_comment_on_status", label: "Status change" },
  { key: "require_comment_on_type", label: "Change type" },
  { key: "require_comment_on_urgency", label: "Urgency" },
  { key: "require_comment_on_impact", label: "Impact" },
  { key: "require_comment_on_owner", label: "Owner reassignment" },
];

const REQUIRE_ACTIVITY_FIELDS: Array<{ key: string; label: string; help: string }> = [
  { key: "require_comment_on_progress", label: "Progress updates", help: "Implementer must include detail when posting a progress note." },
  { key: "require_comment_on_test", label: "Test results", help: "Verification or rollback test outcomes need a written result." },
  { key: "require_comment_on_implementation", label: "Implementation notes", help: "Notes captured during execution must include detail." },
  { key: "require_comment_on_comment", label: "General comments", help: "Free-form discussion comments must include text." },
];

const REQUIRE_STATUS_FIELDS: Array<{ key: string; label: string; help: string }> = [
  { key: "require_comment_on_status_draft", label: "→ Draft", help: "Reverting a change back to draft." },
  { key: "require_comment_on_status_submitted", label: "→ Submitted", help: "Submitting the change for review." },
  { key: "require_comment_on_status_in_review", label: "→ In review", help: "Moving into technical / business review." },
  { key: "require_comment_on_status_cab_review", label: "→ CAB review", help: "Escalating to the Change Advisory Board." },
  { key: "require_comment_on_status_needs_information", label: "→ Needs information", help: "Sending the request back for more detail." },
  { key: "require_comment_on_status_approved", label: "→ Approved", help: "Approving the change for scheduling." },
  { key: "require_comment_on_status_rejected", label: "→ Rejected", help: "Rejecting the change request." },
  { key: "require_comment_on_status_scheduled", label: "→ Scheduled", help: "Scheduling the change implementation window." },
  { key: "require_comment_on_status_in_progress", label: "→ In progress", help: "Starting implementation of the change." },
  { key: "require_comment_on_status_implemented", label: "→ Implemented", help: "Marking the change as implemented." },
  { key: "require_comment_on_status_closed", label: "→ Closed", help: "Closing the change record after PIR." },
  { key: "require_comment_on_status_cancelled", label: "→ Cancelled", help: "Cancelling the change request." },
  { key: "require_comment_on_status_failed", label: "→ Failed", help: "Marking the change as failed." },
];

const DEFAULTS: Record<string, boolean> = {
  notify_on_status_change: true,
  notify_on_type_change: false,
  notify_on_urgency_change: true,
  notify_on_impact_change: true,
  notify_on_owner_change: true,
  notify_on_progress_note: true,
  notify_on_test_result: true,
  notify_on_implementation_note: true,
  notify_on_comment: false,
  notify_on_approval_decision: true,
  require_comment_on_status: false,
  require_comment_on_type: false,
  require_comment_on_urgency: false,
  require_comment_on_impact: false,
  require_comment_on_owner: false,
  require_comment_on_progress: true,
  require_comment_on_test: true,
  require_comment_on_implementation: true,
  require_comment_on_comment: false,
  require_comment_on_status_draft: false,
  require_comment_on_status_submitted: false,
  require_comment_on_status_in_review: false,
  require_comment_on_status_cab_review: false,
  require_comment_on_status_needs_information: true,
  require_comment_on_status_approved: false,
  require_comment_on_status_rejected: true,
  require_comment_on_status_scheduled: false,
  require_comment_on_status_in_progress: false,
  require_comment_on_status_implemented: false,
  require_comment_on_status_closed: false,
  require_comment_on_status_cancelled: true,
  require_comment_on_status_failed: true,
};

export function ChangeNotificationSettings() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, boolean>>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cm-notif-settings", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      const { data } = await supabase
        .from("change_notification_settings")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  useEffect(() => {
    if (data) {
      const merged: Record<string, boolean> = { ...DEFAULTS };
      for (const k of Object.keys(DEFAULTS)) {
        if ((data as any)[k] !== undefined && (data as any)[k] !== null) {
          merged[k] = !!(data as any)[k];
        }
      }
      setValues(merged);
    }
  }, [data]);

  const save = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    const payload = {
      organization_id: currentOrganization.id,
      ...values,
      updated_by: user?.id ?? null,
    };
    const { error } = await supabase
      .from("change_notification_settings")
      .upsert(payload, { onConflict: "organization_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Notification settings saved");
    qc.invalidateQueries({ queryKey: ["cm-notif-settings", currentOrganization.id] });
  };

  if (isLoading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold">Email notifications on activity</h3>
            <p className="text-sm text-muted-foreground">
              Choose which Change Management events automatically email owners, implementers, requesters and approvers.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {NOTIFY_FIELDS.map((f) => (
            <div
              key={f.key}
              className="flex items-start justify-between gap-4 p-3 rounded-md border bg-muted/20"
            >
              <div className="space-y-0.5">
                <Label htmlFor={f.key} className="font-medium">{f.label}</Label>
                <p className="text-xs text-muted-foreground">{f.help}</p>
              </div>
              <Switch
                id={f.key}
                checked={values[f.key]}
                onCheckedChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <MessageSquareWarning className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold">Require an explanatory comment</h3>
            <p className="text-sm text-muted-foreground">
              When enabled, users must enter a note before changing these fields on a Change Request.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REQUIRE_FIELDS.map((f) => (
            <div
              key={f.key}
              className="flex items-center justify-between gap-4 p-3 rounded-md border bg-muted/20"
            >
              <Label htmlFor={f.key} className="font-medium">{f.label}</Label>
              <Switch
                id={f.key}
                checked={values[f.key]}
                onCheckedChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <MessageSquareWarning className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold">Require an explanatory comment on activity posts</h3>
            <p className="text-sm text-muted-foreground">
              When enabled, the implementer or owner must include written detail when posting these activity types from the change record.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REQUIRE_ACTIVITY_FIELDS.map((f) => (
            <div
              key={f.key}
              className="flex items-start justify-between gap-4 p-3 rounded-md border bg-muted/20"
            >
              <div className="space-y-0.5">
                <Label htmlFor={f.key} className="font-medium">{f.label}</Label>
                <p className="text-xs text-muted-foreground">{f.help}</p>
              </div>
              <Switch
                id={f.key}
                checked={values[f.key]}
                onCheckedChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, RotateCcw, Mail, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

/**
 * Per-org email copy overrides. The branded shell (logo, colors, layout) stays
 * locked. Admins can only override: subject, greeting, body, CTA label, footer note.
 *
 * Available variables (substituted at send time by the edge function):
 *   {{user_name}}  {{org_name}}  {{action_url}}  {{site_name}}  {{otp_code}}
 */

type TemplateGroup = "auth" | "app";

interface TemplateDef {
  key: string;
  label: string;
  group: TemplateGroup;
  description: string;
  defaults: TemplateFields & { subject: string };
  variables: string[];
}

interface TemplateFields {
  greeting: string;
  body: string;
  cta_label: string;
  footer_note: string;
}

const TEMPLATES: TemplateDef[] = [
  // ---- Auth ----
  {
    key: "invite",
    label: "User Invitation",
    group: "auth",
    description: "Sent when an admin invites a new user to join the platform.",
    defaults: {
      subject: "You're invited to {{site_name}}",
      greeting: "Hi {{user_name}},",
      body: "You've been invited to join {{org_name}} on {{site_name}}. Click the button below to accept your invitation and set up your account.",
      cta_label: "Accept invitation",
      footer_note: "This invitation will expire in 7 days.",
    },
    variables: ["user_name", "org_name", "action_url", "site_name"],
  },
  {
    key: "signup",
    label: "Signup Confirmation",
    group: "auth",
    description: "Sent after a new user signs up to verify their email address.",
    defaults: {
      subject: "Confirm your {{site_name}} account",
      greeting: "Welcome to {{site_name}}!",
      body: "Please confirm your email address to activate your account and start using the platform.",
      cta_label: "Confirm email",
      footer_note: "If you didn't create this account, you can safely ignore this email.",
    },
    variables: ["user_name", "action_url", "site_name"],
  },
  {
    key: "recovery",
    label: "Password Reset",
    group: "auth",
    description: "Sent when a user requests a password reset.",
    defaults: {
      subject: "Reset your {{site_name}} password",
      greeting: "Hi {{user_name}},",
      body: "We received a request to reset your password. Click the button below to choose a new one.",
      cta_label: "Reset password",
      footer_note: "If you didn't request this, you can safely ignore this email — your password will not change.",
    },
    variables: ["user_name", "action_url", "site_name"],
  },
  {
    key: "magic-link",
    label: "Magic Link / OTP",
    group: "auth",
    description: "Sent when a user requests a passwordless sign-in code.",
    defaults: {
      subject: "Your {{site_name}} sign-in code",
      greeting: "Hi {{user_name}},",
      body: "Use the code below to sign in to {{site_name}}. This code expires in 10 minutes.",
      cta_label: "Sign in",
      footer_note: "If you didn't request this code, you can safely ignore this email.",
    },
    variables: ["user_name", "otp_code", "action_url", "site_name"],
  },
  {
    key: "email-change",
    label: "Email Address Change",
    group: "auth",
    description: "Sent to confirm an email address change.",
    defaults: {
      subject: "Confirm your new email address",
      greeting: "Hi {{user_name}},",
      body: "Please confirm your new email address to complete the change on your {{site_name}} account.",
      cta_label: "Confirm new email",
      footer_note: "If you didn't request this change, please contact your administrator immediately.",
    },
    variables: ["user_name", "action_url", "site_name"],
  },
  {
    key: "reauthentication",
    label: "Reauthentication Code",
    group: "auth",
    description: "Sent when a user must re-verify their identity for a sensitive action.",
    defaults: {
      subject: "Verification code for {{site_name}}",
      greeting: "Hi {{user_name}},",
      body: "Use the verification code below to confirm your identity and continue with your sensitive action.",
      cta_label: "Continue",
      footer_note: "This code expires in 10 minutes. If you didn't request it, please secure your account.",
    },
    variables: ["user_name", "otp_code", "site_name"],
  },
  // ---- App / transactional ----
  {
    key: "task-assigned",
    label: "Task Assigned",
    group: "app",
    description: "Sent when a task is assigned to a user.",
    defaults: {
      subject: "New task assigned: {{task_title}}",
      greeting: "Hi {{user_name}},",
      body: "A new task has been assigned to you in {{org_name}}. Open it to see the details, due date, and priority.",
      cta_label: "View task",
      footer_note: "You can manage your notification preferences from your profile settings.",
    },
    variables: ["user_name", "org_name", "task_title", "action_url", "site_name"],
  },
  {
    key: "programme-weekly-digest",
    label: "Programme Weekly Digest",
    group: "app",
    description: "Weekly programme status summary with RAG, metrics and risks.",
    defaults: {
      subject: "Weekly digest — {{programme_name}}",
      greeting: "Hi {{user_name}},",
      body: "Here is this week's status update for {{programme_name}}, covering RAG status, key metrics, and top risks.",
      cta_label: "Open programme",
      footer_note: "You're receiving this because you're subscribed to programme reports.",
    },
    variables: ["user_name", "programme_name", "action_url", "site_name"],
  },
  {
    key: "document-approval",
    label: "Document Approval Required",
    group: "app",
    description: "Sent to approvers when a document needs review.",
    defaults: {
      subject: "Approval needed: {{document_title}}",
      greeting: "Hi {{user_name}},",
      body: "A document requires your review and approval as part of the {{org_name}} governance workflow.",
      cta_label: "Review document",
      footer_note: "Approvals are tracked for audit purposes per PRINCE2 governance.",
    },
    variables: ["user_name", "org_name", "document_title", "action_url", "site_name"],
  },
  {
    key: "organization-invite",
    label: "Organization Invitation",
    group: "app",
    description: "Sent when a user is invited to join an additional organization.",
    defaults: {
      subject: "You've been invited to {{org_name}}",
      greeting: "Hi {{user_name}},",
      body: "You've been invited to collaborate in {{org_name}} on {{site_name}}. Accept the invitation to get started.",
      cta_label: "Join organization",
      footer_note: "This invitation will expire in 7 days.",
    },
    variables: ["user_name", "org_name", "action_url", "site_name"],
  },
];

interface OverrideRow {
  id: string;
  organization_id: string;
  template_key: string;
  subject: string | null;
  fields: Partial<TemplateFields> | null;
  enabled: boolean;
  updated_at: string;
}

export function EmailTemplatesPanel() {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>(TEMPLATES[0].key);
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({});

  // Working copy for the currently-selected template
  const selected = useMemo(
    () => TEMPLATES.find((t) => t.key === selectedKey)!,
    [selectedKey]
  );
  const [enabled, setEnabled] = useState(true);
  const [subject, setSubject] = useState("");
  const [greeting, setGreeting] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [footerNote, setFooterNote] = useState("");

  useEffect(() => {
    if (!currentOrganization?.id) return;
    void loadAll();
  }, [currentOrganization?.id]);

  useEffect(() => {
    // Hydrate the working copy when selection or overrides change
    const row = overrides[selectedKey];
    const d = selected.defaults;
    setEnabled(row?.enabled ?? false);
    setSubject(row?.subject ?? d.subject);
    setGreeting(row?.fields?.greeting ?? d.greeting);
    setBody(row?.fields?.body ?? d.body);
    setCtaLabel(row?.fields?.cta_label ?? d.cta_label);
    setFooterNote(row?.fields?.footer_note ?? d.footer_note);
  }, [selectedKey, overrides, selected]);

  async function loadAll() {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("org_email_template_overrides")
      .select("*")
      .eq("organization_id", currentOrganization.id);
    if (error) {
      toast.error("Failed to load templates");
      console.error(error);
    } else {
      const map: Record<string, OverrideRow> = {};
      for (const r of (data ?? []) as OverrideRow[]) {
        map[r.template_key] = r;
      }
      setOverrides(map);
    }
    setLoading(false);
  }

  async function save() {
    if (!currentOrganization?.id) return;
    setSaving(true);
    const payload = {
      organization_id: currentOrganization.id,
      template_key: selectedKey,
      subject: subject || null,
      fields: { greeting, body, cta_label: ctaLabel, footer_note: footerNote },
      enabled,
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase as any)
      .from("org_email_template_overrides")
      .upsert(payload, { onConflict: "organization_id,template_key" });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Failed to save template");
      return;
    }
    toast.success(`${selected.label} saved`);
    void loadAll();
  }

  async function resetToDefault() {
    if (!currentOrganization?.id) return;
    if (!overrides[selectedKey]) {
      // Just reset the form
      const d = selected.defaults;
      setSubject(d.subject);
      setGreeting(d.greeting);
      setBody(d.body);
      setCtaLabel(d.cta_label);
      setFooterNote(d.footer_note);
      setEnabled(false);
      return;
    }
    const { error } = await (supabase as any)
      .from("org_email_template_overrides")
      .delete()
      .eq("organization_id", currentOrganization.id)
      .eq("template_key", selectedKey);
    if (error) {
      toast.error("Failed to reset");
      return;
    }
    toast.success("Reset to default");
    void loadAll();
  }

  // Live preview — branded shell mock
  const renderPreview = (text: string) => {
    const map: Record<string, string> = {
      user_name: "Jane Doe",
      org_name: currentOrganization?.name || "Acme Corp",
      site_name: "The TaskMaster",
      action_url: "#",
      otp_code: "428193",
      task_title: "Review Q2 risk register",
      programme_name: "Digital Transformation",
      document_title: "Stage 3 Exception Report",
    };
    return text.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? `{{${k}}}`);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const authTemplates = TEMPLATES.filter((t) => t.group === "auth");
  const appTemplates = TEMPLATES.filter((t) => t.group === "app");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* Template list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Templates</CardTitle>
          <CardDescription>Customize copy per organization</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            <div className="px-3 pb-3 space-y-4">
              <TemplateList
                heading="Authentication"
                items={authTemplates}
                overrides={overrides}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
              />
              <TemplateList
                heading="App notifications"
                items={appTemplates}
                overrides={overrides}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
              />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Editor + preview */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{selected.label}</CardTitle>
                  {overrides[selectedKey] && (
                    <Badge variant="secondary">Customized</Badge>
                  )}
                </div>
                <CardDescription className="mt-1">{selected.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="enabled" className="text-sm text-muted-foreground">
                  Use override
                </Label>
                <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Available variables</AlertTitle>
              <AlertDescription className="text-xs">
                {selected.variables.map((v) => (
                  <code key={v} className="mx-0.5 px-1 bg-muted rounded">{`{{${v}}}`}</code>
                ))}
                <span className="ml-2 text-muted-foreground">
                  These are replaced automatically when the email is sent. The branded
                  layout (logo, colors, footer) stays consistent across all orgs.
                </span>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject line</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="greeting">Greeting</Label>
                <Input id="greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cta">Button label</Label>
                <Input id="cta" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Body copy</Label>
              <Textarea
                id="body"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer">Footer note</Label>
              <Textarea
                id="footer"
                rows={2}
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetToDefault} disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to default
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live preview</CardTitle>
            <CardDescription>
              Variables filled with sample data. Branded shell shown for context.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="max-w-[560px] mx-auto bg-white border rounded-md overflow-hidden shadow-sm">
                <div
                  className="px-6 py-4 text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(213 60% 25%) 0%, hsl(178 58% 42%) 100%)",
                  }}
                >
                  <div className="font-bold">● The TaskMaster</div>
                  <div className="text-xs opacity-80 mt-0.5">
                    Programme &amp; Project Information Management
                  </div>
                </div>
                <div className="px-6 py-6 text-sm text-slate-700 space-y-4">
                  <div className="font-semibold text-slate-900 text-base">
                    {renderPreview(subject)}
                  </div>
                  <div>{renderPreview(greeting)}</div>
                  <div className="leading-relaxed whitespace-pre-wrap">
                    {renderPreview(body)}
                  </div>
                  <div>
                    <span className="inline-block bg-[hsl(178,58%,40%)] text-white text-sm font-semibold rounded-md px-5 py-2">
                      {renderPreview(ctaLabel)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 pt-3 border-t">
                    {renderPreview(footerNote)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TemplateList({
  heading,
  items,
  overrides,
  selectedKey,
  onSelect,
}: {
  heading: string;
  items: TemplateDef[];
  overrides: Record<string, OverrideRow>;
  selectedKey: string;
  onSelect: (k: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground px-2 pt-3 pb-1">
        {heading}
      </div>
      <div className="space-y-1">
        {items.map((t) => {
          const isActive = t.key === selectedKey;
          const isCustom = !!overrides[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelect(t.key)}
              className={`w-full text-left px-2 py-2 rounded-md text-sm transition flex items-center justify-between ${
                isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/40"
              }`}
            >
              <span>{t.label}</span>
              {isCustom && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Customized" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

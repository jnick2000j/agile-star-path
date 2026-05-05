import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Mail, Send, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

type Transport = "lovable" | "smtp" | "resend";

interface EmailSettingsRow {
  id: string;
  organization_id: string;
  active_transport: Transport;
  from_address: string | null;
  from_name: string | null;
  reply_to: string | null;
  last_test_status: string | null;
  last_test_at: string | null;
  last_test_error: string | null;
}

const TRANSPORT_INFO: Record<Transport, { label: string; description: string; secrets: string[] }> = {
  lovable: {
    label: "Lovable Emails (recommended)",
    description: "Built-in queue, retries, and bounce handling. Zero configuration.",
    secrets: [],
  },
  smtp: {
    label: "Custom SMTP",
    description: "Office 365, Gmail, SendGrid, AWS SES, on-prem Postfix — anything with SMTP.",
    secrets: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_TLS"],
  },
  resend: {
    label: "Resend",
    description: "Modern transactional email API. Requires a verified domain on Resend.",
    secrets: ["RESEND_API_KEY"],
  },
};

export function EmailSettings() {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [row, setRow] = useState<EmailSettingsRow | null>(null);
  const [transport, setTransport] = useState<Transport>("lovable");
  const [fromAddress, setFromAddress] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [testRecipient, setTestRecipient] = useState("");

  useEffect(() => {
    if (!currentOrganization?.id) return;
    void load();
  }, [currentOrganization?.id]);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("email_settings")
      .select("*")
      .eq("organization_id", currentOrganization!.id)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      console.error(error);
      toast.error("Failed to load email settings");
    }
    if (data) {
      setRow(data as EmailSettingsRow);
      setTransport(data.active_transport);
      setFromAddress(data.from_address ?? "");
      setFromName(data.from_name ?? "");
      setReplyTo((data as any).reply_to ?? "");
    }
    setLoading(false);
  }

  async function save() {
    if (!currentOrganization?.id) return;
    setSaving(true);
    const payload = {
      organization_id: currentOrganization.id,
      active_transport: transport,
      from_address: fromAddress || null,
      from_name: fromName || null,
    };
    const { error } = await (supabase as any)
      .from("email_settings")
      .upsert(payload, { onConflict: "organization_id" });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Failed to save email settings");
      return;
    }
    toast.success("Email settings saved");
    void load();
  }

  async function sendTest() {
    if (!testRecipient || !currentOrganization?.id) {
      toast.error("Enter a recipient email");
      return;
    }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("send-test-email", {
      body: { recipient: testRecipient, organization_id: currentOrganization.id },
    });
    setTesting(false);
    if (error || !(data as any)?.ok) {
      const msg = (data as any)?.error || error?.message || "Unknown error";
      toast.error(`Test failed: ${msg}`);
    } else {
      toast.success(`Test email sent via ${(data as any).transport}`);
    }
    void load();
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Email Settings</CardTitle>
          </div>
          <CardDescription>
            Choose how this organization sends outbound emails (weekly reports, notifications, invites).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={transport}
            onValueChange={(v) => setTransport(v as Transport)}
            className="space-y-3"
          >
            {(Object.keys(TRANSPORT_INFO) as Transport[]).map((key) => {
              const info = TRANSPORT_INFO[key];
              return (
                <label
                  key={key}
                  htmlFor={`transport-${key}`}
                  className="flex items-start gap-3 rounded-lg border bg-card p-4 cursor-pointer hover:bg-accent/40 transition"
                >
                  <RadioGroupItem id={`transport-${key}`} value={key} className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{info.label}</span>
                      {row?.active_transport === key && (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                    {info.secrets.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Required secrets: {info.secrets.map((s) => <code key={s} className="mx-0.5 px-1 bg-muted rounded">{s}</code>)}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-name">From name</Label>
              <Input
                id="from-name"
                placeholder="TaskMaster"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-address">From address</Label>
              <Input
                id="from-address"
                type="email"
                placeholder="notifications@yourcompany.com"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
              />
            </div>
          </div>

          {transport === "smtp" && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>SMTP secrets required</AlertTitle>
              <AlertDescription>
                Add the SMTP credentials as backend secrets so edge functions can connect to your mail server.
              </AlertDescription>
            </Alert>
          )}
          {transport === "resend" && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Resend API key required</AlertTitle>
              <AlertDescription>
                Add <code>RESEND_API_KEY</code> as a backend secret and verify your sending domain on Resend.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
          <CardDescription>
            Verify the active transport is configured correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="you@example.com"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              className="flex-1"
            />
            <Button onClick={sendTest} disabled={testing || !testRecipient}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send test
            </Button>
          </div>

          {row?.last_test_at && (
            <Alert variant={row.last_test_status === "success" ? "default" : "destructive"}>
              {row.last_test_status === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle>
                Last test: {row.last_test_status} ({new Date(row.last_test_at).toLocaleString()})
              </AlertTitle>
              {row.last_test_error && (
                <AlertDescription className="font-mono text-xs">{row.last_test_error}</AlertDescription>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

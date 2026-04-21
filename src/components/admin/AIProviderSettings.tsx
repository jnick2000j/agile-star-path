import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { toast } from "sonner";

interface ProviderRow {
  id: string;
  scope: "global" | "organization";
  organization_id: string | null;
  provider: "lovable" | "openai" | "anthropic" | "azure_openai" | "ollama";
  default_model: string | null;
  base_url: string | null;
  api_key_secret_name: string | null;
  is_active: boolean;
  notes: string | null;
}

const PROVIDER_LABELS: Record<ProviderRow["provider"], string> = {
  lovable: "Lovable AI Gateway (default)",
  openai: "OpenAI (GPT-5 / GPT-4)",
  anthropic: "Anthropic (Claude)",
  azure_openai: "Azure OpenAI",
  ollama: "Self-hosted (Ollama / vLLM)",
};

const SUGGESTED_SECRETS: Record<ProviderRow["provider"], string> = {
  lovable: "LOVABLE_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  azure_openai: "AZURE_OPENAI_API_KEY",
  ollama: "",
};

export function AIProviderSettings() {
  const { currentOrganization } = useOrganization();
  const { hasFeature, loading: featuresLoading } = usePlanFeatures();
  const allowed = hasFeature("feature_byo_ai_provider");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<ProviderRow | null>(null);
  const [form, setForm] = useState({
    provider: "openai" as ProviderRow["provider"],
    default_model: "",
    base_url: "",
    api_key_secret_name: "",
    is_active: true,
    notes: "",
  });

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    supabase
      .from("ai_provider_settings")
      .select("*")
      .eq("scope", "organization")
      .eq("organization_id", currentOrganization.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRow(data as ProviderRow);
          setForm({
            provider: data.provider as ProviderRow["provider"],
            default_model: data.default_model ?? "",
            base_url: data.base_url ?? "",
            api_key_secret_name: data.api_key_secret_name ?? "",
            is_active: data.is_active,
            notes: data.notes ?? "",
          });
        }
        setLoading(false);
      });
  }, [currentOrganization?.id]);

  const handleSave = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    const payload = {
      scope: "organization" as const,
      organization_id: currentOrganization.id,
      provider: form.provider,
      default_model: form.default_model || null,
      base_url: form.base_url || null,
      api_key_secret_name: form.api_key_secret_name || null,
      is_active: form.is_active,
      notes: form.notes || null,
    };
    const { error } = row
      ? await supabase.from("ai_provider_settings").update(payload).eq("id", row.id)
      : await supabase.from("ai_provider_settings").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("AI provider settings saved");
  };

  const handleReset = async () => {
    if (!row) return;
    setSaving(true);
    const { error } = await supabase.from("ai_provider_settings").delete().eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRow(null);
    setForm({ provider: "openai", default_model: "", base_url: "", api_key_secret_name: "", is_active: true, notes: "" });
    toast.success("Reverted to platform default AI provider");
  };

  if (featuresLoading || loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-12">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading AI provider settings…</span>
        </CardContent>
      </Card>
    );
  }

  if (!allowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> AI Provider — Business plan feature
          </CardTitle>
          <CardDescription>
            Bring your own AI provider (OpenAI, Anthropic, Azure OpenAI, or self-hosted Ollama) is available on the Business and Enterprise plans.
            All other organizations use the built-in Lovable AI Gateway.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>How this works</AlertTitle>
        <AlertDescription>
          By default every AI feature in the platform is routed through the Lovable AI Gateway. Configure a custom provider here to route this organization's
          AI calls to your own account instead. The API key is stored as a backend secret — only the secret <em>name</em> lives in this configuration.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Custom AI provider for {currentOrganization?.name}</CardTitle>
          <CardDescription>
            {row ? (
              <>Active override — provider: <Badge variant="secondary">{PROVIDER_LABELS[row.provider]}</Badge></>
            ) : (
              "No override configured. This org currently uses the Lovable AI Gateway."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select
              value={form.provider}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, provider: v as ProviderRow["provider"], api_key_secret_name: SUGGESTED_SECRETS[v as ProviderRow["provider"]] || f.api_key_secret_name }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Default model</Label>
            <Input
              placeholder={form.provider === "openai" ? "gpt-5" : form.provider === "anthropic" ? "claude-3-5-sonnet-20241022" : "model identifier"}
              value={form.default_model}
              onChange={(e) => setForm((f) => ({ ...f, default_model: e.target.value }))}
            />
          </div>

          {(form.provider === "azure_openai" || form.provider === "ollama" || form.provider === "openai") && (
            <div className="grid gap-2">
              <Label>Base URL {form.provider === "azure_openai" && <span className="text-muted-foreground">(required for Azure)</span>}</Label>
              <Input
                placeholder={form.provider === "azure_openai" ? "https://<resource>.openai.azure.com/openai/deployments/<deployment>" : form.provider === "ollama" ? "http://localhost:11434" : "(optional override)"}
                value={form.base_url}
                onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label>API key secret name</Label>
            <Input
              placeholder={SUGGESTED_SECRETS[form.provider] || "(none for Ollama)"}
              value={form.api_key_secret_name}
              onChange={(e) => setForm((f) => ({ ...f, api_key_secret_name: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              The name of a backend secret containing your API key. Add the secret in <strong>Project → Settings → Backend Secrets</strong> and put its name here.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Active</Label>
              <p className="text-xs text-muted-foreground">Disable to temporarily fall back to the Lovable AI Gateway.</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {row ? "Update settings" : "Enable custom provider"}
            </Button>
            {row && (
              <Button variant="outline" onClick={handleReset} disabled={saving}>
                Revert to platform default
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
import { Sparkles, Loader2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

/**
 * Platform-scoped AI provider settings. Affects every org that has not
 * configured its own override under AdminPanel → AI Provider tab.
 */
export function PlatformAIProviderSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<ProviderRow | null>(null);
  const [form, setForm] = useState({
    provider: "lovable" as ProviderRow["provider"],
    default_model: "google/gemini-2.5-flash",
    base_url: "",
    api_key_secret_name: "LOVABLE_API_KEY",
    is_active: true,
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ai_provider_settings")
      .select("*")
      .eq("scope", "global")
      .maybeSingle();
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
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      scope: "global" as const,
      organization_id: null,
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
    if (error) return toast.error(error.message);
    toast.success("Platform AI provider saved");
    await load();
  };

  if (loading) {
    return (
      <Card><CardContent className="flex items-center gap-2 py-12">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading platform AI settings…</span>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Platform default AI provider</AlertTitle>
        <AlertDescription>
          This is the AI provider used by every organization that has not configured its own override.
          The Lovable AI Gateway is used by default. For air-gapped or on-prem deployments, switch this to a
          self-hosted provider (Ollama / vLLM) or BYO keys for OpenAI / Anthropic / Azure.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" /> Global default
          </CardTitle>
          <CardDescription>
            {row ? (
              <>Active default — provider: <Badge variant="secondary">{PROVIDER_LABELS[row.provider]}</Badge></>
            ) : (
              "No platform default configured. The fallback (Lovable Gateway) is used."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select
              value={form.provider}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  provider: v as ProviderRow["provider"],
                  api_key_secret_name: SUGGESTED_SECRETS[v as ProviderRow["provider"]] || f.api_key_secret_name,
                }))
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
              placeholder={
                form.provider === "openai" ? "gpt-5" :
                form.provider === "anthropic" ? "claude-3-5-sonnet-20241022" :
                form.provider === "lovable" ? "google/gemini-2.5-flash" :
                "model identifier"
              }
              value={form.default_model}
              onChange={(e) => setForm((f) => ({ ...f, default_model: e.target.value }))}
            />
          </div>

          {(form.provider === "azure_openai" || form.provider === "ollama" || form.provider === "openai") && (
            <div className="grid gap-2">
              <Label>Base URL</Label>
              <Input
                placeholder={
                  form.provider === "azure_openai" ? "https://<resource>.openai.azure.com/openai/deployments/<deployment>" :
                  form.provider === "ollama" ? "http://localhost:11434" :
                  "(optional override)"
                }
                value={form.base_url}
                onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label>API key secret name</Label>
            <Input
              placeholder={SUGGESTED_SECRETS[form.provider] || "(none for self-hosted)"}
              value={form.api_key_secret_name}
              onChange={(e) => setForm((f) => ({ ...f, api_key_secret_name: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Stored as a backend secret. Only the secret <em>name</em> lives in this configuration.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Active</Label>
              <p className="text-xs text-muted-foreground">Disable to fall back to the Lovable AI Gateway.</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {row ? "Update default" : "Set platform default"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

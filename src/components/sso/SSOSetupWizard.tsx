import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Copy,
  CheckCircle2,
  Building2,
  Globe,
  Send,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface SSOSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onComplete?: () => void;
}

const SUPABASE_PROJECT_REF = "lpsbudbighowwdmgdfyc";
const ACS_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1/sso/saml/acs`;
const ENTITY_ID = `https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1/sso/saml/metadata`;

type ProviderType = "saml" | "oidc";

interface DomainStatus {
  domain: string;
  status: "pending" | "verified" | "failed";
  token?: string;
  host?: string;
  checking?: boolean;
}

export function SSOSetupWizard({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  onComplete,
}: SSOSetupWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [providerType, setProviderType] = useState<ProviderType>("saml");
  const [metadataUrl, setMetadataUrl] = useState("");
  const [oidcIssuerUrl, setOidcIssuerUrl] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [domains, setDomains] = useState("");
  const [defaultAccessLevel, setDefaultAccessLevel] = useState("viewer");
  const [notes, setNotes] = useState("");
  const [ssoConfigId, setSsoConfigId] = useState<string | null>(null);
  const [domainStatuses, setDomainStatuses] = useState<DomainStatus[]>([]);

  const reset = () => {
    setStep(1);
    setProviderType("saml");
    setMetadataUrl("");
    setOidcIssuerUrl("");
    setOidcClientId("");
    setDomains("");
    setDefaultAccessLevel("viewer");
    setNotes("");
    setSsoConfigId(null);
    setDomainStatuses([]);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const parseDomains = (raw: string): string[] =>
    raw
      .split(/[,\s\n]+/)
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

  const validateStep2 = (): boolean => {
    if (providerType === "saml") {
      if (!metadataUrl.trim()) {
        toast.error("IdP metadata URL is required");
        return false;
      }
      try {
        new URL(metadataUrl.trim());
      } catch {
        toast.error("Please enter a valid metadata URL");
        return false;
      }
    } else {
      if (!oidcIssuerUrl.trim() || !oidcClientId.trim()) {
        toast.error("OIDC issuer URL and client ID are required");
        return false;
      }
      try {
        new URL(oidcIssuerUrl.trim());
      } catch {
        toast.error("Please enter a valid issuer URL");
        return false;
      }
    }
    const parsed = parseDomains(domains);
    if (parsed.length === 0) {
      toast.error("Add at least one allowed email domain");
      return false;
    }
    const invalid = parsed.find((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d));
    if (invalid) {
      toast.error(`"${invalid}" is not a valid domain`);
      return false;
    }
    return true;
  };

  // Create the sso_configurations row + issue verification tokens for each domain
  const createConfigAndIssueTokens = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const parsedDomains = parseDomains(domains);
      const insertPayload: any = {
        organization_id: organizationId,
        provider_type: providerType,
        allowed_domains: parsedDomains,
        default_access_level: defaultAccessLevel,
        notes: notes.trim() || null,
        status: "pending",
        requested_by: user.id,
        entity_id: providerType === "saml" ? ENTITY_ID : null,
        acs_url: providerType === "saml" ? ACS_URL : null,
        metadata_url: providerType === "saml" ? metadataUrl.trim() : null,
        oidc_issuer_url: providerType === "oidc" ? oidcIssuerUrl.trim() : null,
        oidc_client_id: providerType === "oidc" ? oidcClientId.trim() : null,
      };

      const { data: ssoConfig, error } = await supabase
        .from("sso_configurations")
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;
      setSsoConfigId(ssoConfig.id);

      // Issue domain verification tokens
      const issued: DomainStatus[] = [];
      for (const d of parsedDomains) {
        const { data, error: vErr } = await supabase.functions.invoke("verify-domain", {
          body: { action: "issue", organization_id: organizationId, domain: d },
        });
        if (vErr) throw vErr;
        issued.push({
          domain: d,
          status: data.status,
          token: data.token,
          host: data.host,
        });
      }
      setDomainStatuses(issued);

      await supabase.rpc("log_audit_event", {
        _event_type: "sso_config_drafted",
        _event_category: "sso",
        _organization_id: organizationId,
        _target_entity_type: "sso_configuration",
        _target_entity_id: ssoConfig.id,
        _metadata: { provider_type: providerType, domains: parsedDomains },
      });

      setStep(3);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to draft SSO request");
    } finally {
      setSubmitting(false);
    }
  };

  const checkDomain = async (domain: string) => {
    setDomainStatuses((prev) =>
      prev.map((d) => (d.domain === domain ? { ...d, checking: true } : d))
    );
    try {
      const { data, error } = await supabase.functions.invoke("verify-domain", {
        body: { action: "check", organization_id: organizationId, domain },
      });
      if (error) throw error;
      setDomainStatuses((prev) =>
        prev.map((d) =>
          d.domain === domain
            ? { ...d, status: data.status, checking: false }
            : d
        )
      );
      if (data.verified) toast.success(`${domain} verified ✓`);
      else toast.message(`No matching TXT record yet for ${domain}`, {
        description: "DNS can take a few minutes to propagate.",
      });
    } catch (e: any) {
      setDomainStatuses((prev) =>
        prev.map((d) => (d.domain === domain ? { ...d, checking: false } : d))
      );
      toast.error(e.message || "Verification check failed");
    }
  };

  const allVerified = domainStatuses.length > 0 && domainStatuses.every((d) => d.status === "verified");

  const activate = async () => {
    if (!ssoConfigId) return;
    setSubmitting(true);
    try {
      const fnName = providerType === "saml" ? "register-tenant-saml" : "register-tenant-oidc";
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { sso_configuration_id: ssoConfigId },
      });
      if (error) throw error;
      if (data?.pending_review) {
        toast.success("OIDC connection submitted for platform review.");
      } else {
        toast.success("SSO is now active! Users from your verified domains can sign in.");
      }
      setStep(4);
      onComplete?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to activate SSO");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            SSO Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Configure single sign-on for {organizationName}. Step {step} of 4.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Choose protocol + service provider details */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold mb-2">Choose your protocol</h3>
              <RadioGroup
                value={providerType}
                onValueChange={(v) => setProviderType(v as ProviderType)}
                className="grid grid-cols-2 gap-3"
              >
                <label
                  htmlFor="proto-saml"
                  className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                    providerType === "saml" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value="saml" id="proto-saml" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">SAML 2.0</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Okta, Azure AD / Entra, OneLogin, ADFS, PingFederate
                    </p>
                  </div>
                </label>
                <label
                  htmlFor="proto-oidc"
                  className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                    providerType === "oidc" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value="oidc" id="proto-oidc" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">OpenID Connect</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auth0, Keycloak, Cognito, custom OIDC
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {providerType === "saml" && (
              <>
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Service Provider Details</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Paste these into your IdP when creating the SAML application.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      ACS URL (Reply URL)
                    </Label>
                    <div className="flex gap-2">
                      <Input value={ACS_URL} readOnly className="font-mono text-xs" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(ACS_URL, "ACS URL")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Entity ID (Audience URI)
                    </Label>
                    <div className="flex gap-2">
                      <Input value={ENTITY_ID} readOnly className="font-mono text-xs" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(ENTITY_ID, "Entity ID")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Alert>
                    <AlertDescription className="text-xs">
                      <strong>Required attribute mapping:</strong> Map <code>email</code> to
                      your IdP's email attribute. Optionally map <code>first_name</code>,{" "}
                      <code>last_name</code>, <code>full_name</code>, and <code>groups</code>.
                    </AlertDescription>
                  </Alert>
                </div>
              </>
            )}

            {providerType === "oidc" && (
              <Alert>
                <AlertDescription className="text-xs">
                  In your OIDC IdP, register a confidential client with redirect URI{" "}
                  <code>https://{SUPABASE_PROJECT_REF}.supabase.co/auth/v1/callback</code>{" "}
                  and the standard scopes <code>openid email profile</code>.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: IdP details */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Identity Provider details</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your IdP information and the email domains your users will sign in with.
              </p>
            </div>

            {providerType === "saml" ? (
              <div className="space-y-2">
                <Label htmlFor="metadata-url">
                  IdP Metadata URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="metadata-url"
                  placeholder="https://your-idp.com/app/metadata"
                  value={metadataUrl}
                  onChange={(e) => setMetadataUrl(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="oidc-issuer">
                    OIDC Issuer URL <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="oidc-issuer"
                    placeholder="https://your-tenant.auth0.com/"
                    value={oidcIssuerUrl}
                    onChange={(e) => setOidcIssuerUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oidc-client-id">
                    Client ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="oidc-client-id"
                    placeholder="abc123..."
                    value={oidcClientId}
                    onChange={(e) => setOidcClientId(e.target.value)}
                  />
                </div>
                <Alert>
                  <AlertDescription className="text-xs">
                    The OIDC client secret is supplied separately by our platform team after
                    you submit. We'll contact you with the secure handoff details.
                  </AlertDescription>
                </Alert>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="domains">
                Allowed Email Domains <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="domains"
                placeholder="acme.com, subsidiary.acme.com"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Each domain must be DNS-verified before SSO activates.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-level">Default Access Level for new SSO users</Label>
              <Select value={defaultAccessLevel} onValueChange={setDefaultAccessLevel}>
                <SelectTrigger id="access-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                  <SelectItem value="editor">Editor (create & edit)</SelectItem>
                  <SelectItem value="manager">Manager (manage team)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="IdP brand, group→role mapping requirements, target go-live..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step 3: Domain verification */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Verify domain ownership</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add the TXT record below to your DNS for each domain. Once verified, click{" "}
                <strong>Activate SSO</strong>.
              </p>
            </div>

            <div className="space-y-3">
              {domainStatuses.map((d) => (
                <div key={d.domain} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{d.domain}</span>
                    </div>
                    {d.status === "verified" ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                        Pending
                      </Badge>
                    )}
                  </div>

                  {d.status !== "verified" && (
                    <>
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-xs">
                        <Label className="text-muted-foreground">Type</Label>
                        <code className="font-mono bg-muted px-2 py-1 rounded">TXT</code>
                        <span />
                        <Label className="text-muted-foreground">Host</Label>
                        <code className="font-mono bg-muted px-2 py-1 rounded text-xs break-all">
                          {d.host}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(d.host!, "Host")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Label className="text-muted-foreground">Value</Label>
                        <code className="font-mono bg-muted px-2 py-1 rounded text-xs break-all">
                          {d.token}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(d.token!, "Token")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => checkDomain(d.domain)}
                        disabled={d.checking}
                      >
                        {d.checking ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                            Checking DNS...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 mr-2" />
                            Check verification
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {!allVerified && (
              <Alert>
                <AlertDescription className="text-xs">
                  DNS propagation can take a few minutes (sometimes up to an hour). You can
                  close this dialog and return later — your draft is saved.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="space-y-4 text-center py-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">SSO is live!</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Users from your verified domains can now sign in via{" "}
                <strong>Sign in with SSO</strong> on the login page.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-left text-xs space-y-1 max-w-md mx-auto">
              <div className="font-medium mb-1">First-time SSO users will:</div>
              <div className="text-muted-foreground">
                1. Be auto-provisioned with{" "}
                <Badge variant="outline" className="capitalize text-[10px] py-0">
                  {defaultAccessLevel}
                </Badge>{" "}
                access
              </div>
              <div className="text-muted-foreground">
                2. Be added to {organizationName} automatically
              </div>
              <div className="text-muted-foreground">
                3. Land on their dashboard, signed in
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => (step > 1 && step < 4 ? setStep(step - 1) : handleClose(false))}
            disabled={submitting}
          >
            {step === 1 || step === 4 ? (
              "Close"
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>

          {step === 1 && (
            <Button onClick={() => setStep(2)}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 2 && (
            <Button
              onClick={() => {
                if (!validateStep2()) return;
                createConfigAndIssueTokens();
              }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Drafting...
                </>
              ) : (
                <>
                  Issue verification tokens
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}

          {step === 3 && (
            <Button onClick={activate} disabled={!allVerified || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Activate SSO
                </>
              )}
            </Button>
          )}

          {step === 4 && <Button onClick={() => handleClose(false)}>Done</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

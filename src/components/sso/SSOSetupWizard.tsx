import { useState } from "react";
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
  const [metadataUrl, setMetadataUrl] = useState("");
  const [domains, setDomains] = useState("");
  const [defaultAccessLevel, setDefaultAccessLevel] = useState("viewer");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setStep(1);
    setMetadataUrl("");
    setDomains("");
    setDefaultAccessLevel("viewer");
    setNotes("");
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard`);
  };

  const parseDomains = (raw: string): string[] => {
    return raw
      .split(/[,\s\n]+/)
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  };

  const validateStep2 = (): boolean => {
    if (!metadataUrl.trim()) {
      toast.error("IdP metadata URL is required");
      return false;
    }
    try {
      new URL(metadataUrl.trim());
    } catch {
      toast.error("Please enter a valid URL");
      return false;
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

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const parsedDomains = parseDomains(domains);

      const { data: ssoConfig, error } = await supabase
        .from("sso_configurations")
        .insert({
          organization_id: organizationId,
          metadata_url: metadataUrl.trim(),
          entity_id: ENTITY_ID,
          acs_url: ACS_URL,
          allowed_domains: parsedDomains,
          default_access_level: defaultAccessLevel,
          notes: notes.trim() || null,
          status: "pending",
          requested_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await supabase.rpc("log_audit_event", {
        _event_type: "sso_config_requested",
        _event_category: "sso",
        _organization_id: organizationId,
        _target_entity_type: "sso_configuration",
        _target_entity_id: ssoConfig.id,
        _metadata: {
          domains: parsedDomains,
          default_access_level: defaultAccessLevel,
        },
      });

      // Notify platform admin via edge function (best-effort)
      try {
        await supabase.functions.invoke("notify-sso-request", {
          body: {
            sso_config_id: ssoConfig.id,
            organization_name: organizationName,
            domains: parsedDomains,
            metadata_url: metadataUrl.trim(),
          },
        });
      } catch (e) {
        console.warn("SSO notification email failed (non-fatal):", e);
      }

      toast.success("SSO request submitted! Our team will review and provision it shortly.");
      setStep(4);
      onComplete?.();
    } catch (e: any) {
      console.error("SSO request error:", e);
      toast.error(e.message || "Failed to submit SSO request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            SSO/SAML Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Configure single sign-on for {organizationName}. Step {step} of 4.
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
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

        {/* Step 1: Service Provider Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Step 1: Service Provider Details</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Copy these values into your identity provider (Okta, Azure AD, OneLogin, etc.)
                when creating a new SAML application.
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
                  <strong>Required attribute mapping:</strong> Map <code>email</code> to your IdP's
                  email attribute (e.g. <code>user.email</code>). Optionally map{" "}
                  <code>first_name</code>, <code>last_name</code>, and <code>full_name</code>.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        )}

        {/* Step 2: IdP Configuration */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Step 2: Identity Provider Details</h3>
              <p className="text-sm text-muted-foreground mb-4">
                After creating the SAML app in your IdP, paste the metadata URL and configure
                allowed email domains.
              </p>
            </div>

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
              <p className="text-xs text-muted-foreground">
                Provided by your identity provider after creating the SAML application.
              </p>
            </div>

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
                Comma- or space-separated. Users with these email domains will be auto-routed to
                SSO sign-in.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-level">Default Access Level for New SSO Users</Label>
              <Select value={defaultAccessLevel} onValueChange={setDefaultAccessLevel}>
                <SelectTrigger id="access-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                  <SelectItem value="editor">Editor (can create & edit)</SelectItem>
                  <SelectItem value="manager">Manager (can manage team)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                First-time SSO users will get this access level. You can change individual users
                later.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes for our provisioning team (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any special requirements, IdP brand (Okta / Azure / etc.), preferred go-live date..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Step 3: Review & Submit</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Confirm your configuration. Our team will review and provision SSO within 1
                business day.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Organization</div>
                  <div className="font-medium">{organizationName}</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">IdP Metadata URL</div>
                  <div className="font-mono text-xs break-all">{metadataUrl}</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">Allowed Domains</div>
                  <div className="flex flex-wrap gap-1">
                    {parseDomains(domains).map((d) => (
                      <Badge key={d} variant="secondary" className="text-xs">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Default Access Level</div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {defaultAccessLevel}
                  </Badge>
                </div>
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                After submission, you'll receive a notification when SSO is active. New users from
                your allowed domains will be auto-provisioned on their first SSO sign-in.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="space-y-4 text-center py-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Request Submitted!</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your SSO configuration request is in our queue. Our team will provision it within 1
                business day and notify you when it's active.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-left text-xs space-y-1 max-w-md mx-auto">
              <div className="font-medium mb-1">What happens next?</div>
              <div className="text-muted-foreground">
                1. Our team reviews your IdP metadata
              </div>
              <div className="text-muted-foreground">
                2. We provision the SAML connection on our infrastructure
              </div>
              <div className="text-muted-foreground">
                3. You'll receive an in-app notification when it's live
              </div>
              <div className="text-muted-foreground">
                4. Users from your domains will see "Sign in with SSO"
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
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

          {step < 3 && (
            <Button
              onClick={() => {
                if (step === 2 && !validateStep2()) return;
                setStep(step + 1);
              }}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 3 && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          )}

          {step === 4 && (
            <Button onClick={() => handleClose(false)}>Done</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

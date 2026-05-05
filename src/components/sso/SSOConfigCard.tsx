import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { SSOSetupWizard } from "./SSOSetupWizard";
import { useOrganization } from "@/hooks/useOrganization";
import { ShieldCheck, Lock, Clock, CheckCircle2, XCircle, Settings, Info } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface SSOConfig {
  id: string;
  status: string;
  metadata_url: string | null;
  allowed_domains: string[];
  default_access_level: string;
  created_at: string;
  activated_at: string | null;
  provisioning_notes: string | null;
}

export function SSOConfigCard() {
  const { currentOrganization } = useOrganization();
  const [config, setConfig] = useState<SSOConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPaidPlan, setHasPaidPlan] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadData();
    }
  }, [currentOrganization?.id]);

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);

    try {
      const [configRes, planRes] = await Promise.all([
        supabase
          .from("sso_configurations")
          .select("*")
          .eq("organization_id", currentOrganization.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("has_paid_plan", { _org_id: currentOrganization.id }),
      ]);

      setConfig(configRes.data);
      setHasPaidPlan(planRes.data === true);
    } catch (e) {
      console.error("SSO config load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, { icon: any; label: string; className: string }> = {
      pending: {
        icon: Clock,
        label: "Pending Review",
        className: "bg-warning/10 text-warning border-warning/20",
      },
      active: {
        icon: CheckCircle2,
        label: "Active",
        className: "bg-success/10 text-success border-success/20",
      },
      rejected: {
        icon: XCircle,
        label: "Rejected",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      },
      disabled: {
        icon: XCircle,
        label: "Disabled",
        className: "bg-muted text-muted-foreground",
      },
    };
    const v = variants[status] || variants.pending;
    const Icon = v.icon;
    return (
      <Badge variant="outline" className={v.className}>
        <Icon className="h-3 w-3 mr-1" />
        {v.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground text-sm">Loading...</div>
      </Card>
    );
  }

  if (!hasPaidPlan) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold mb-1">SSO/SAML — Paid Plans Only</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Single sign-on with SAML 2.0 is available on all paid plans. Upgrade to enable
              enterprise authentication for your organization.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/billing">View Plans</Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">Single Sign-On (SAML)</h3>
              <p className="text-sm text-muted-foreground">
                Enterprise SSO via your identity provider
              </p>
            </div>
          </div>
          {config && statusBadge(config.status)}
        </div>

        <Alert className="mb-4 bg-muted/40">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs leading-relaxed">
            <strong>How SSO works across multiple Organizations:</strong> SSO is matched by
            email domain. Once active, any user signing in with an allowed domain is
            authenticated through your identity provider and can then access <em>every</em>{" "}
            Organization they have been granted membership in — a single SSO connection is
            automatically reused across all of your Orgs.
            <br />
            <br />
            <strong>Security &amp; Access remain per Organization:</strong> SSO only
            establishes <em>who</em> the user is. Roles, permissions, data visibility, and
            admin scope are still controlled separately within each Organization via{" "}
            <em>User &amp; Access Management</em>. Granting SSO access does not grant access
            to any Org's data — membership and access levels must still be assigned per Org.
          </AlertDescription>
        </Alert>

        {!config && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Configure SAML 2.0 SSO with Okta, Azure AD, OneLogin, or any SAML-compliant
              identity provider. Users from your allowed domains will be auto-provisioned on first
              sign-in.
            </p>
            <Button onClick={() => setWizardOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configure SSO
            </Button>
          </>
        )}

        {config && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Allowed Domains</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {config.allowed_domains.map((d) => (
                    <Badge key={d} variant="secondary" className="text-xs">
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Default Access</div>
                <Badge variant="outline" className="capitalize text-xs mt-1">
                  {config.default_access_level}
                </Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Submitted</div>
                <div>{format(new Date(config.created_at), "MMM d, yyyy")}</div>
              </div>
              {config.activated_at && (
                <div>
                  <div className="text-xs text-muted-foreground">Activated</div>
                  <div>{format(new Date(config.activated_at), "MMM d, yyyy")}</div>
                </div>
              )}
            </div>

            {config.status === "pending" && (
              <Alert>
                <AlertDescription className="text-xs">
                  Your request is in our review queue. We'll notify you when SSO is active —
                  typically within 1 business day.
                </AlertDescription>
              </Alert>
            )}

            {config.status === "rejected" && config.provisioning_notes && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  <strong>Reason:</strong> {config.provisioning_notes}
                </AlertDescription>
              </Alert>
            )}

            {(config.status === "rejected" || config.status === "disabled") && (
              <Button onClick={() => setWizardOpen(true)} variant="outline" size="sm">
                Submit New Request
              </Button>
            )}
          </div>
        )}
      </Card>

      {currentOrganization && (
        <SSOSetupWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          organizationId={currentOrganization.id}
          organizationName={currentOrganization.name}
          onComplete={loadData}
        />
      )}
    </>
  );
}

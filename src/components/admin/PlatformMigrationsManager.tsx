import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeftRight, Building2, Search, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MigrationsPanel } from "@/components/migration/MigrationsPanel";

interface OrgRow {
  id: string;
  name: string;
  slug: string | null;
  is_suspended: boolean | null;
  is_archived: boolean | null;
}

/**
 * Platform-portal control surface for tenant data migrations.
 *
 * Lets a platform admin pick a tenant organization and run / monitor
 * migration jobs for that org, instead of letting org owners trigger
 * migrations themselves from the Admin Portal.
 */
export function PlatformMigrationsManager() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("organizations")
        .select("id,name,slug,is_suspended,is_archived")
        .order("name", { ascending: true });
      if (!active) return;
      if (!error && data) setOrgs(data as OrgRow[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.slug ?? "").toLowerCase().includes(q),
    );
  }, [orgs, search]);

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId) ?? null,
    [orgs, selectedOrgId],
  );

  if (selectedOrg) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {selectedOrg.name}
                  {selectedOrg.slug && (
                    <span className="text-sm text-muted-foreground font-normal">/{selectedOrg.slug}</span>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  All migration actions below run against this tenant.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedOrgId(null)}
              >
                <X className="h-4 w-4 mr-1" /> Switch tenant
              </Button>
            </div>
          </CardHeader>
        </Card>

        <MigrationsPanel
          showHeader={false}
          organizationIdOverride={selectedOrg.id}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Platform-controlled migrations</AlertTitle>
        <AlertDescription>
          Migrations are run by platform operators on behalf of tenants. Pick an
          organization below to start or monitor an import.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Select tenant
          </CardTitle>
          <CardDescription>
            Choose the organization you want to import data into.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations..."
              className="pl-9"
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading organizations…</p>
          ) : filteredOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No organizations match "{search}".
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {filteredOrgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => setSelectedOrgId(org.id)}
                  className="text-left rounded-md border border-border bg-card hover:bg-accent transition-colors p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{org.name}</p>
                    {org.slug && (
                      <p className="text-xs text-muted-foreground truncate">/{org.slug}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {org.is_archived ? (
                      <Badge variant="outline">Archived</Badge>
                    ) : org.is_suspended ? (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                        Suspended
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        Active
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Users, Building2, UserCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

interface ContactRow {
  role: string;
  display_name: string | null;
  email: string | null;
  customer_organization_name: string | null;
  entity_type: string;
}

/**
 * Surfaces JSM customer / reporter / participant data imported via the
 * migration runner. Aggregates counts per role and lists the top customer
 * organizations by ticket volume.
 */
export function JsmContactsSummary() {
  const { currentOrganization } = useOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-jsm-contacts", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const orgId = currentOrganization!.id;

      // Per-ticket attachments — used for role mix + top customer orgs by ticket volume
      const { data: contactData, error: contactErr } = await supabase
        .from("migration_contacts")
        .select(
          "role,display_name,email,customer_organization_name,entity_type",
        )
        .eq("organization_id", orgId)
        .limit(2000);
      if (contactErr) throw contactErr;
      const rows = (contactData ?? []) as ContactRow[];

      // Deduplicated directory — the source of truth for "unique people / orgs"
      const { data: dirData, error: dirErr } = await supabase
        .from("migration_contact_directory")
        .select("contact_type,ticket_count,organization_name")
        .eq("organization_id", orgId)
        .limit(2000);
      if (dirErr) throw dirErr;
      const directory = (dirData ?? []) as {
        contact_type: "person" | "organization";
        ticket_count: number;
        organization_name: string | null;
      }[];

      const byRole = new Map<string, number>();
      const byOrg = new Map<string, number>();
      for (const r of rows) {
        byRole.set(r.role, (byRole.get(r.role) ?? 0) + 1);
        if (r.customer_organization_name) {
          byOrg.set(
            r.customer_organization_name,
            (byOrg.get(r.customer_organization_name) ?? 0) + 1,
          );
        }
      }

      const uniquePeople = directory.filter((d) => d.contact_type === "person").length;
      const uniqueOrgs = directory.filter((d) => d.contact_type === "organization").length;

      const topOrgs = [...byOrg.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      return {
        total: rows.length,
        uniquePeople,
        uniqueOrgs,
        participants: byRole.get("participant") ?? 0,
        topOrgs,
      };
    },
  });

  const hasData = (data?.total ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Service Management Contacts
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="text-xs">
          <Link to="/admin/migrations">
            View imports <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading contacts…</p>
        ) : !hasData ? (
          <p className="text-xs text-muted-foreground">
            No imported contacts yet. Run a Jira Service Management import to
            attach reporters, participants and customer organizations to
            tickets.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">
                  Reporters
                </p>
                <p className="text-base font-semibold flex items-center gap-1">
                  <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {data!.reporters}
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">
                  Participants
                </p>
                <p className="text-base font-semibold">{data!.participants}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">
                  Customer orgs
                </p>
                <p className="text-base font-semibold flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {data!.customerOrgs}
                </p>
              </div>
            </div>
            {data!.topOrgs.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase text-muted-foreground">
                  Top customer organizations
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data!.topOrgs.map(([name, count]) => (
                    <Badge key={name} variant="secondary" className="gap-1">
                      <Building2 className="h-3 w-3" />
                      {name}
                      <span className="text-muted-foreground">· {count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

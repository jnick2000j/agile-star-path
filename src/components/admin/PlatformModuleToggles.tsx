import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpdeskModuleToggles } from "./HelpdeskModuleToggles";

interface Org { id: string; name: string }

export function PlatformModuleToggles() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      setOrgs((data ?? []) as Org[]);
      if (data && data.length && !orgId) setOrgId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Helpdesk Module Toggles</h3>
            <p className="text-sm text-muted-foreground">Enable or disable helpdesk sub-modules per organization. Changes apply immediately.</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="org-pick" className="text-sm whitespace-nowrap">Organization</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger id="org-pick" className="w-[260px]">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
      {orgId && <HelpdeskModuleToggles organizationId={orgId} />}
    </div>
  );
}

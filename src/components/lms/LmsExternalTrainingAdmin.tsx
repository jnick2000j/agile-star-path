import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { ExternalTrainingPanel } from "./ExternalTrainingPanel";
import { toast } from "sonner";

export function LmsExternalTrainingAdmin() {
  const { currentOrganization } = useOrganization();
  const [requireApproval, setRequireApproval] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!currentOrganization?.id) return;
      setLoading(true);
      const { data } = await (supabase as any)
        .from("lms_external_training_settings")
        .select("require_approval")
        .eq("organization_id", currentOrganization.id)
        .maybeSingle();
      setRequireApproval(!!data?.require_approval);
      setLoading(false);
    })();
  }, [currentOrganization?.id]);

  const toggle = async (val: boolean) => {
    if (!currentOrganization?.id) return;
    setRequireApproval(val);
    const { error } = await (supabase as any)
      .from("lms_external_training_settings")
      .upsert(
        { organization_id: currentOrganization.id, require_approval: val },
        { onConflict: "organization_id" }
      );
    if (error) {
      toast.error(error.message);
      setRequireApproval(!val);
    } else {
      toast.success("Settings saved");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 flex items-center justify-between gap-4">
          <div>
            <Label className="text-base">Require manager approval</Label>
            <p className="text-xs text-muted-foreground mt-1">
              When enabled, external training records must be approved by a manager or admin before they count toward totals.
            </p>
          </div>
          <Switch checked={requireApproval} onCheckedChange={toggle} disabled={loading} />
        </CardContent>
      </Card>

      <ExternalTrainingPanel managerView />
    </div>
  );
}

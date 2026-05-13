import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export function ReconcileMigratedUsersCard() {
  const { currentOrganization } = useOrganization();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async (dryRun: boolean) => {
    if (!currentOrganization?.id) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-migration-users", {
        body: { organization_id: currentOrganization.id, dry_run: dryRun },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data);
      toast.success(
        dryRun
          ? `Preview: ${data.matched} matchable, ${data.candidates} candidates`
          : `Reconciled: ${data.updated} updated of ${data.matched} matched`,
      );
    } catch (e: any) {
      toast.error(e.message || "Reconciliation failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Reconcile imported users
        </CardTitle>
        <CardDescription>
          Sweep records imported from external systems and back-fill assignees
          when the original user has since joined this organization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button onClick={() => run(true)} variant="outline" disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Preview matches
          </Button>
          <Button onClick={() => run(false)} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Reconcile now
          </Button>
        </div>
        {result && (
          <Alert>
            <AlertTitle>
              {result.dry_run ? "Preview result" : "Reconciliation result"}
            </AlertTitle>
            <AlertDescription className="text-xs">
              <div>Candidates scanned: {result.candidates ?? 0}</div>
              <div>Matched to platform users: {result.matched}</div>
              <div>Records updated: {result.updated}</div>
              {result.by_entity && (
                <ul className="mt-2 list-disc pl-4">
                  {Object.entries(result.by_entity).map(([k, v]: any) => (
                    <li key={k}>
                      <strong>{k}</strong>: matched {v.matched}, updated {v.updated}
                      {v.skipped_filled ? `, skipped (already filled) ${v.skipped_filled}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

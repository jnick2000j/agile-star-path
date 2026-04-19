import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TrialBanner() {
  const { currentOrganization } = useOrganization();
  const [sub, setSub] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    supabase
      .from("organization_subscriptions")
      .select("status, trial_ends_at, plan_id, subscription_plans(name)")
      .eq("organization_id", currentOrganization.id)
      .maybeSingle()
      .then(({ data }) => setSub(data));
  }, [currentOrganization?.id]);

  if (dismissed || !sub || sub.status !== "trialing" || !sub.trial_ends_at) return null;

  const ends = new Date(sub.trial_ends_at);
  const daysLeft = Math.ceil((ends.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const expired = daysLeft <= 0;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm border-b ${
      expired ? "bg-destructive/10 border-destructive/30" : "bg-primary/5 border-primary/20"
    }`}>
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <span className="flex-1">
        {expired
          ? "Your free trial has ended. Upgrade to continue creating new resources."
          : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial.`}
      </span>
      <Button asChild size="sm" variant={expired ? "destructive" : "default"}>
        <Link to="/billing">View plans</Link>
      </Button>
      {!expired && (
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

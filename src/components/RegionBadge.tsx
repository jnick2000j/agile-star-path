import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, MapPin, ShieldAlert } from "lucide-react";

const REGION_LABELS: Record<string, string> = {
  global: "Global",
  eu: "EU",
  us: "US",
  uk: "UK",
  apac: "APAC",
  ca: "CA",
};

export function RegionBadge() {
  const { currentOrganization } = useOrganization();
  const [info, setInfo] = useState<{ region: string; mode: string; locked: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!currentOrganization?.id) { setInfo(null); return; }
    supabase
      .from("organizations")
      .select("data_region, residency_enforcement, residency_locked_at")
      .eq("id", currentOrganization.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setInfo({
          region: (data.data_region as string) ?? "global",
          mode: (data.residency_enforcement as string) ?? "warn",
          locked: !!data.residency_locked_at,
        });
      });
    return () => { cancelled = true; };
  }, [currentOrganization?.id]);

  if (!info || info.region === "global") return null;

  const label = REGION_LABELS[info.region] ?? info.region.toUpperCase();
  const Icon = info.mode === "block" ? ShieldAlert : MapPin;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={info.mode === "block" ? "default" : "secondary"} className="gap-1.5 cursor-help">
            <Icon className="h-3 w-3" />
            {label}
            {info.locked && <Lock className="h-3 w-3" />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Data residency: <strong>{label}</strong><br />
            Enforcement: <strong>{info.mode === "block" ? "Hard block" : "Soft warn"}</strong>
            {info.locked && <><br />Region is locked.</>}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

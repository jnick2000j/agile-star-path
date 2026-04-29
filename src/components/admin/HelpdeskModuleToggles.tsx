import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HELPDESK_MODULE_CATALOG, useModuleToggles } from "@/hooks/useModuleToggles";

interface Props {
  /** Optional override; defaults to current org. Platform admins can pass a different org. */
  organizationId?: string | null;
  /** Disable interactions (e.g., user lacks permission). */
  readOnly?: boolean;
}

export function HelpdeskModuleToggles({ organizationId, readOnly = false }: Props) {
  const { isEnabled, setEnabled, loading } = useModuleToggles(organizationId);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {HELPDESK_MODULE_CATALOG.map((m) => {
        const on = isEnabled(m.key);
        return (
          <Card key={m.key} className="p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{m.label}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{m.description}</p>
            </div>
            <Switch
              checked={on}
              disabled={readOnly}
              onCheckedChange={(v) => setEnabled(m.key, v)}
              aria-label={`Toggle ${m.label}`}
            />
          </Card>
        );
      })}
    </div>
  );
}

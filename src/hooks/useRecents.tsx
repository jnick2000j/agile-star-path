import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface RecentEntity {
  id: string;
  entity_type: string;
  entity_id: string | null;
  label: string;
  href: string;
  viewed_at: string;
}

export function useRecents(limit = 8) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-recents", user?.id, limit],
    queryFn: async (): Promise<RecentEntity[]> => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_recent_entities")
        .select("id, entity_type, entity_id, label, href, viewed_at")
        .eq("user_id", user.id)
        .order("viewed_at", { ascending: false })
        .limit(limit);
      return (data || []) as RecentEntity[];
    },
    enabled: !!user,
  });
}

/**
 * Call from any entity detail page to register a "view" so the dashboard
 * can surface it under Recents. Safe to call repeatedly — it upserts.
 */
export function useTrackRecent(opts: {
  entityType: string;
  entityId?: string | null;
  label?: string | null;
  href?: string;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { entityType, entityId, label, href, enabled = true } = opts;

  useEffect(() => {
    if (!user || !enabled || !label || !href) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase
        .from("user_recent_entities")
        .upsert(
          {
            user_id: user.id,
            entity_type: entityType,
            entity_id: entityId ?? null,
            label,
            href,
            viewed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,entity_type,entity_id,href" }
        );
      if (!cancelled && !error) {
        qc.invalidateQueries({ queryKey: ["user-recents", user.id] });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, entityType, entityId, label, href, enabled, qc]);
}

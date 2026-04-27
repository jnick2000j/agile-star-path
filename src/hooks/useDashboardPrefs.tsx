import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DashboardPrefs {
  default_tab: string;
  quick_actions: string[];
  sidebar_favorites: string[]; // array of nav hrefs
}

const DEFAULTS: DashboardPrefs = {
  default_tab: "my-work",
  quick_actions: ["new-task", "log-time", "new-project", "log-update", "raise-risk", "open-ticket"],
  sidebar_favorites: [],
};

export function useDashboardPrefs() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["dashboard-prefs", user?.id],
    queryFn: async (): Promise<DashboardPrefs> => {
      if (!user) return DEFAULTS;
      const { data } = await supabase
        .from("user_dashboard_prefs")
        .select("default_tab, quick_actions, sidebar_favorites")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return DEFAULTS;
      return {
        default_tab: data.default_tab || DEFAULTS.default_tab,
        quick_actions: (data.quick_actions as string[]) || DEFAULTS.quick_actions,
        sidebar_favorites: (data.sidebar_favorites as string[]) || [],
      };
    },
    enabled: !!user,
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<DashboardPrefs>) => {
      if (!user) throw new Error("Not signed in");
      const next = { ...(query.data || DEFAULTS), ...patch };
      const { error } = await supabase
        .from("user_dashboard_prefs")
        .upsert(
          { user_id: user.id, ...next },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-prefs", user?.id] });
    },
  });

  return { prefs: query.data || DEFAULTS, isLoading: query.isLoading, update: update.mutateAsync };
}
